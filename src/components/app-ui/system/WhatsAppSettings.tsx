import { MessageSquare, Phone, QrCode, Check, AlertTriangle, Save, Link as LinkIcon, Unlink, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export function WhatsAppSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [config, setConfig] = useState({
    businessName: 'Igreja Exemplo',
    phoneNumber: '+55 11 99999-9999',
    apiKey: '',
    webhookUrl: 'https://mrm.exemplo.com/webhooks/whatsapp',
  });

  const [showQRCode, setShowQRCode] = useState(false);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WhatsApp Business</h1>
        <p className="text-slate-600 dark:text-slate-400">Integração com WhatsApp API</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Connection Status */}
        <div className={`rounded-xl border-2 p-6 ${
          isConnected
            ? 'bg-green-50 border-green-200'
            : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
              isConnected ? 'bg-green-100' : 'bg-orange-100'
            }`}>
              <MessageSquare className={`w-7 h-7 ${
                isConnected ? 'text-green-600' : 'text-orange-600'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className={`font-bold text-lg ${
                  isConnected ? 'text-green-900' : 'text-orange-900'
                }`}>
                  {isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
                </h3>
                {isConnected && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                    Online
                  </span>
                )}
              </div>
              <p className={`text-sm mb-4 ${
                isConnected ? 'text-green-700' : 'text-orange-700'
              }`}>
                {isConnected
                  ? 'Sua conta WhatsApp Business está conectada e pronta para enviar mensagens.'
                  : 'Conecte sua conta WhatsApp Business para começar a enviar mensagens automatizadas.'}
              </p>
              <div className="flex gap-3">
                {!isConnected ? (
                  <button
                    onClick={() => {
                      setShowQRCode(true);
                      setTimeout(() => {
                        setIsConnected(true);
                        setShowQRCode(false);
                      }, 3000);
                    }}
                    className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <LinkIcon className="w-5 h-5" />
                    Conectar WhatsApp
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsConnected(false)}
                      className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Unlink className="w-5 h-5" />
                      Desconectar
                    </button>
                    <button className="flex items-center gap-2 bg-white border border-green-300 text-green-700 px-5 py-2.5 rounded-lg hover:bg-green-50 transition-colors">
                      <RefreshCw className="w-5 h-5" />
                      Reconectar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Modal */}
        {showQRCode && (
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Escaneie o QR Code</h3>
              <p className="text-slate-600 mb-6">
                Abra o WhatsApp no seu celular e escaneie este código para conectar
              </p>
              
              {/* Simulated QR Code */}
              <div className="w-64 h-64 bg-slate-100 border-4 border-slate-300 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <QrCode className="w-32 h-32 text-slate-400" />
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                Aguardando conexão...
              </div>
            </div>
          </div>
        )}

        {/* Business Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Phone className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Informações do Negócio</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Configure os dados da sua conta WhatsApp Business</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nome do Negócio
              </label>
              <input
                type="text"
                value={config.businessName}
                onChange={(e) => setConfig(prev => ({ ...prev, businessName: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Igreja Exemplo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Número de Telefone
              </label>
              <input
                type="text"
                value={config.phoneNumber}
                onChange={(e) => setConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="+55 11 99999-9999"
                disabled={isConnected}
              />
              {isConnected && (
                <p className="text-xs text-slate-500 mt-1">
                  Para alterar o número, você precisa desconectar primeiro
                </p>
              )}
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <LinkIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Configuração da API</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Chaves e webhooks para integração</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                API Key (Opcional)
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Digite sua API key do WhatsApp Business"
              />
              <p className="text-xs text-slate-500 mt-1">
                Necessário apenas se você estiver usando WhatsApp Business API oficial
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.webhookUrl}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50"
                  readOnly
                />
                <button className="px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  Copiar
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Use esta URL nas configurações de webhook do WhatsApp Business
              </p>
            </div>
          </div>
        </div>

        {/* Message Limits */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Limites de Mensagens</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Mensagens Enviadas (Hoje)</span>
                <span className="text-sm font-bold text-purple-600">245 / 1000</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '24.5%' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Mensagens Enviadas (Mês)</span>
                <span className="text-sm font-bold text-blue-600">3.450 / 10.000</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '34.5%' }} />
              </div>
            </div>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <strong>Plano Atual:</strong> Business (10.000 mensagens/mês)
              <button className="ml-2 text-blue-600 hover:text-blue-700 font-semibold">
                Fazer upgrade
              </button>
            </p>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Configurações Avançadas</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Auto-resposta</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Enviar resposta automática fora do horário comercial</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Confirmação de Leitura</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Mostrar ticks azuis quando mensagens forem lidas</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Notificações de Grupo</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Receber notificações de mensagens em grupos</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
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
