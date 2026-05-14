import { Mail, Server, User, Lock, Send, Check, AlertTriangle, Save, TestTube } from 'lucide-react';
import { useState } from 'react';

export function EmailSettings() {
  const [config, setConfig] = useState({
    provider: 'smtp',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpEncryption: 'tls',
    smtpUsername: 'igreja@exemplo.com',
    smtpPassword: '••••••••',
    senderName: 'Igreja Exemplo',
    senderEmail: 'noreply@igreja.com',
    replyTo: 'contato@igreja.com',
  });

  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleTestEmail = () => {
    setTestStatus('sending');
    setTimeout(() => {
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    }, 2000);
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações de Email</h1>
        <p className="text-slate-600 dark:text-slate-400">SMTP, remetentes e configurações de envio</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Provider Selection */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Provedor de Email</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Escolha como enviar emails</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <button
              onClick={() => setConfig(prev => ({ ...prev, provider: 'smtp' }))}
              className={`p-4 border-2 rounded-lg transition-all ${
                config.provider === 'smtp'
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Server className={`w-6 h-6 mb-2 ${config.provider === 'smtp' ? 'text-purple-600' : 'text-slate-600'}`} />
              <p className="font-semibold text-slate-900 mb-1">SMTP Customizado</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Use seu próprio servidor</p>
            </button>

            <button
              onClick={() => setConfig(prev => ({ ...prev, provider: 'sendgrid' }))}
              className={`p-4 border-2 rounded-lg transition-all ${
                config.provider === 'sendgrid'
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Mail className={`w-6 h-6 mb-2 ${config.provider === 'sendgrid' ? 'text-purple-600' : 'text-slate-600'}`} />
              <p className="font-semibold text-slate-900 mb-1">SendGrid</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">API do SendGrid</p>
            </button>

            <button
              onClick={() => setConfig(prev => ({ ...prev, provider: 'mailgun' }))}
              className={`p-4 border-2 rounded-lg transition-all ${
                config.provider === 'mailgun'
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Send className={`w-6 h-6 mb-2 ${config.provider === 'mailgun' ? 'text-purple-600' : 'text-slate-600'}`} />
              <p className="font-semibold text-slate-900 mb-1">Mailgun</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">API do Mailgun</p>
            </button>
          </div>
        </div>

        {/* SMTP Configuration */}
        {config.provider === 'smtp' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-6">Configuração SMTP</h3>
            
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Servidor SMTP
                  </label>
                  <input
                    type="text"
                    value={config.smtpHost}
                    onChange={(e) => setConfig(prev => ({ ...prev, smtpHost: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Porta
                  </label>
                  <input
                    type="text"
                    value={config.smtpPort}
                    onChange={(e) => setConfig(prev => ({ ...prev, smtpPort: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="587"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Criptografia
                </label>
                <select
                  value={config.smtpEncryption}
                  onChange={(e) => setConfig(prev => ({ ...prev, smtpEncryption: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="none">Nenhuma</option>
                  <option value="ssl">SSL</option>
                  <option value="tls">TLS</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Usuário
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={config.smtpUsername}
                      onChange={(e) => setConfig(prev => ({ ...prev, smtpUsername: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="usuario@exemplo.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={config.smtpPassword}
                      onChange={(e) => setConfig(prev => ({ ...prev, smtpPassword: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sender Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Informações do Remetente</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Como seus emails aparecerão</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nome do Remetente
              </label>
              <input
                type="text"
                value={config.senderName}
                onChange={(e) => setConfig(prev => ({ ...prev, senderName: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Igreja Exemplo"
              />
              <p className="text-xs text-slate-500 mt-1">Este nome aparecerá na caixa de entrada dos destinatários</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email do Remetente
                </label>
                <input
                  type="email"
                  value={config.senderEmail}
                  onChange={(e) => setConfig(prev => ({ ...prev, senderEmail: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="noreply@igreja.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email de Resposta
                </label>
                <input
                  type="email"
                  value={config.replyTo}
                  onChange={(e) => setConfig(prev => ({ ...prev, replyTo: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="contato@igreja.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Test Email */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TestTube className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Testar Configuração</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Envie um email de teste para verificar se está funcionando</p>
            </div>
          </div>

          <div className="flex gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="seu@email.com"
            />
            <button
              onClick={handleTestEmail}
              disabled={testStatus === 'sending'}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {testStatus === 'sending' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Enviar Teste
                </>
              )}
            </button>
          </div>

          {testStatus === 'success' && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900 mb-1">Email enviado com sucesso!</p>
                  <p className="text-sm text-green-700">Verifique sua caixa de entrada em {testEmail}</p>
                </div>
              </div>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 mb-1">Erro ao enviar email</p>
                  <p className="text-sm text-red-700">Verifique suas configurações SMTP e tente novamente</p>
                </div>
              </div>
            </div>
          )}
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
