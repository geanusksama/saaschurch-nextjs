import { Link } from 'react-router';
import { Shield, Smartphone, Key } from 'lucide-react';
import { useState } from 'react';

export function TwoFactorSetup() {
  const [code, setCode] = useState(['', '', '', '', '', '']);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-500 to-cyan-500 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Configurar 2FA</h1>
          <p className="text-slate-600 dark:text-slate-400">Adicione uma camada extra de segurança</p>
        </div>

        <div className="space-y-6">
          <div className="bg-purple-50 rounded-lg p-6 text-center">
            <Smartphone className="w-16 h-16 text-purple-600 mx-auto mb-4" />
            <p className="text-sm text-slate-700 mb-4">
              Escaneie o QR Code abaixo com seu aplicativo autenticador (Google Authenticator, Authy, etc)
            </p>
            <div className="w-48 h-48 bg-white border-4 border-purple-600 rounded-lg mx-auto flex items-center justify-center">
              <span className="text-slate-400">QR Code</span>
            </div>
            <p className="text-xs text-slate-500 mt-4">Chave: ABCD-EFGH-IJKL-MNOP</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Digite o código de 6 dígitos
            </label>
            <div className="flex gap-2 justify-center">
              {code.map((digit, i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const newCode = [...code];
                    newCode[i] = e.target.value;
                    setCode(newCode);
                  }}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              ))}
            </div>
          </div>

          <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all">
            Ativar 2FA
          </button>

          <Link to="/auth/login" className="block text-center text-sm text-slate-600 hover:text-purple-600">
            Voltar ao Login
          </Link>
        </div>
      </div>
    </div>
  );
}
