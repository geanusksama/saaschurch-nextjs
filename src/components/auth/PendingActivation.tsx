import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Clock, LogOut, ShieldCheck, Mail, Phone, BookOpen, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

import { apiBase } from '../../lib/apiBase';

const MODULES = [
  { icon: BookOpen, label: 'Membros', locked: true },
  { icon: ShieldCheck, label: 'Secretaria', locked: true },
  { icon: Mail, label: 'Comunicação', locked: true },
  { icon: Phone, label: 'Pastoral', locked: true },
];

export function PendingActivation() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState('');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('mrm_token');
    localStorage.removeItem('mrm_user');
    navigate('/auth/login');
  };

  const handleCheck = async () => {
    setChecking(true);
    setCheckMsg('');
    try {
      const token = localStorage.getItem('mrm_token');
      if (!token) { navigate('/auth/login'); return; }
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const user = await res.json();
      if (user.profileType && user.profileType !== 'pending') {
        localStorage.setItem('mrm_user', JSON.stringify(user));
        navigate('/app-ui/dashboard');
      } else {
        setCheckMsg('Seu perfil ainda está aguardando ativação.');
      }
    } catch {
      setCheckMsg('Não foi possível verificar. Tente novamente.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">M</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">MRM – Gestão Ministerial</h1>
          <p className="text-purple-200 text-sm">Sistema de Gestão Eclesiástica</p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header amarelo */}
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-amber-900">Conta aguardando ativação</h2>
              <p className="text-sm text-amber-700 mt-0.5">
                Seu cadastro foi recebido. Um administrador precisa ativar seu perfil.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* O que acontece depois */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Próximos passos:</p>
              <ol className="space-y-2.5">
                {[
                  'Um administrador do seu campo ou igreja irá visualizar seu cadastro na lista de usuários.',
                  'Ele vai editar seu perfil, definir sua função (secretário, tesoureiro, etc.) e vincular sua igreja.',
                  'Após a ativação, você receberá acesso às funcionalidades do seu perfil.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Módulos bloqueados (preview) */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Módulos disponíveis após ativação:</p>
              <div className="grid grid-cols-2 gap-2">
                {MODULES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 opacity-50"
                  >
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-200 rounded px-1.5 py-0.5">
                      Bloqueado
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info de contato */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Entre em contato com o administrador da sua igreja ou campo para agilizar a ativação.
            </div>

            {checkMsg && (
              <p className="text-sm text-center text-slate-600">{checkMsg}</p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {checking ? <Loader className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {checking ? 'Verificando...' : 'Verificar ativação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
