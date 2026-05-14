import { Shield, Lock, Key, Smartphone, AlertTriangle, Check, Save } from 'lucide-react';
import { useState } from 'react';

export function Security() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [passwordExpiry, setPasswordExpiry] = useState('90');

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações de Segurança</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie autenticação, senhas e políticas de segurança</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Two-Factor Authentication */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Autenticação de Dois Fatores (2FA)</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Adicione uma camada extra de segurança com verificação em duas etapas</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={twoFactorEnabled}
                onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {twoFactorEnabled && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-purple-900 mb-1">2FA Ativado</p>
                  <p className="text-sm text-purple-700">Todos os usuários serão solicitados a configurar autenticação de dois fatores no próximo login.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Password Policy */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Política de Senha</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Configure requisitos de complexidade de senha</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
              <label className="text-sm text-slate-700">Mínimo de 8 caracteres</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
              <label className="text-sm text-slate-700">Incluir letras maiúsculas e minúsculas</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
              <label className="text-sm text-slate-700">Incluir números</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
              <label className="text-sm text-slate-700">Incluir caracteres especiais (!@#$%)</label>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Expiração de senha (dias)
              </label>
              <input
                type="number"
                value={passwordExpiry}
                onChange={(e) => setPasswordExpiry(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-slate-500 mt-1">0 = nunca expira</p>
            </div>
          </div>
        </div>

        {/* Session Management */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Key className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Gerenciamento de Sessão</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Configure tempo limite e segurança de sessão</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tempo limite de inatividade (minutos)
              </label>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="120">2 horas</option>
                <option value="480">8 horas</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
              <label className="text-sm text-slate-700">Permitir apenas uma sessão ativa por usuário</label>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
              <label className="text-sm text-slate-700">Forçar logout em todos os dispositivos após trocar senha</label>
            </div>
          </div>
        </div>

        {/* Login Attempts */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Proteção contra Ataques</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Configure limites de tentativas de login</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Máximo de tentativas de login
              </label>
              <input
                type="number"
                defaultValue="5"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tempo de bloqueio (minutos)
              </label>
              <input
                type="number"
                defaultValue="30"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
              <label className="text-sm text-slate-700">Notificar administrador sobre bloqueios</label>
            </div>
          </div>
        </div>

        {/* IP Whitelist */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 mb-1">Lista Branca de IPs</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Restrinja acesso a IPs específicos (opcional)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: 192.168.1.0/24"
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                Adicionar
              </button>
            </div>
            <p className="text-xs text-slate-500">Adicione endereços IP ou faixas CIDR permitidas</p>
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
