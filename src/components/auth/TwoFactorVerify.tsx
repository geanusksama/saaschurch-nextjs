import { Link } from 'react-router';
import { Shield } from 'lucide-react';
import { useState } from 'react';

export function TwoFactorVerify() {
  const [code, setCode] = useState(['', '', '', '', '', '']);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-500 to-cyan-500 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Verificação 2FA</h1>
          <p className="text-slate-600 dark:text-slate-400">Digite o código do seu aplicativo autenticador</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 text-center">
              Código de 6 dígitos
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
            Verificar e Entrar
          </button>

          <div className="text-center">
            <Link to="/auth/login" className="text-sm text-slate-600 hover:text-purple-600">
              Usar outro método
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
