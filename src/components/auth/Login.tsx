import { Link, useNavigate } from 'react-router';
import { Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { del, get, set } from 'idb-keyval';

import { apiBase } from '../../lib/apiBase';

export function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError || !data.session) {
        setError('Email ou senha inválidos.');
        return;
      }

      const sessionToken = data.session.access_token;
      const fallbackUser = {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || data.user.email,
        profileType: data.user.user_metadata?.profile_type || 'church',
      };

      const profileResponse = await fetch(`${apiBase}/auth/me`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!profileResponse.ok) {
        if (profileResponse.status === 401 || profileResponse.status === 403) {
          throw new Error('Sessao invalida. Faca login novamente.');
        }

        throw new Error('Backend indisponivel. Nao foi possivel carregar seu perfil.');
      }

      const profileData = await profileResponse.json().catch(() => {
        throw new Error('Backend indisponivel. A resposta da API nao retornou JSON valido.');
      });
      const resolvedUser = {
        ...fallbackUser,
        ...profileData,
      };

      localStorage.removeItem('mrm_permissions');
      await del('secretaria-cache').catch(() => {});

      localStorage.setItem('mrm_token', sessionToken);
      localStorage.setItem('mrm_user', JSON.stringify(resolvedUser));

      // Mantém um marcador do último login apenas para diagnóstico futuro.
      const lastUserId = await get<string>('mrm_last_user_id').catch(() => null);
      if (lastUserId && lastUserId !== resolvedUser.id) {
        await del('secretaria-cache').catch(() => {});
      }
      await set('mrm_last_user_id', resolvedUser.id).catch(() => {});

      localStorage.removeItem('mrm_selected_context');
      localStorage.removeItem('mrm_active_field_id');
      localStorage.removeItem('mrm_active_field_name');

      if (resolvedUser.campoId) {
        localStorage.setItem('mrm_active_field_id', resolvedUser.campoId);
      }
      if (resolvedUser.campoName) {
        localStorage.setItem('mrm_active_field_name', resolvedUser.campoName);
      }

      if (resolvedUser.profileType === 'pending') {
        navigate('/pending-activation');
        return;
      }

      navigate('/app-ui');
    } catch (err) {
      localStorage.removeItem('mrm_token');
      localStorage.removeItem('mrm_user');
      localStorage.removeItem('mrm_permissions');
      await del('secretaria-cache').catch(() => {});
      setError(err instanceof Error ? err.message : 'Nao foi possivel concluir o login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2073&auto=format&fit=crop')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
        
        <div className="relative z-10 w-full p-12 lg:p-16 flex flex-col justify-between h-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-emerald-500/20">
              M
            </div>
            <span className="text-white font-extrabold tracking-widest text-sm uppercase">MRM GESTÃO</span>
          </div>

          {/* Main Content */}
          <div className="mt-auto mb-16">
            <h1 className="text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-[1.1] tracking-tight">
              Sistema<br />Administrativo
            </h1>
            <p className="text-slate-300 text-lg max-w-md mb-12 leading-relaxed">
              Gerencie membros, congregações, financeiro e acompanhe sua igreja em tempo real.
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                <p className="text-white font-extrabold text-2xl mb-1 tracking-tight">+1k</p>
                <p className="text-slate-400 text-xs font-semibold tracking-wide uppercase">Membros Ativos</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                <p className="text-white font-extrabold text-2xl mb-1 tracking-tight">R$ 4.2M</p>
                <p className="text-slate-400 text-xs font-semibold tracking-wide uppercase">Gestão Financeira</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                <p className="text-white font-extrabold text-2xl mb-1 tracking-tight">100%</p>
                <p className="text-slate-400 text-xs font-semibold tracking-wide uppercase">Integrado</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-slate-500 text-xs font-medium">
            © {new Date().getFullYear()} MRM. Área restrita à liderança.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* Mobile Logo (visible only on small screens) */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-emerald-500 rounded text-white flex items-center justify-center font-bold text-lg">
              M
            </div>
            <span className="text-slate-900 font-extrabold tracking-widest text-sm uppercase">MRM GESTÃO</span>
          </div>

          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#0f172a] mb-2 tracking-tight">Bem-vindo de volta</h2>
          <p className="text-sm text-slate-500 mb-10">Entre com suas credenciais para acessar o painel.</p>

          {/* Tabs */}
          <div className="flex gap-2 mb-10">
            <div className="px-5 py-2 bg-slate-950 text-white text-xs font-bold rounded-full cursor-default tracking-wide shadow-sm shadow-slate-950/20">
              ENTRAR
            </div>
            <Link to="/auth/register" className="px-5 py-2 bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-full transition-colors tracking-wide">
              CRIAR CONTA
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-widest uppercase">
                E-mail
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm text-slate-900 placeholder:text-slate-300 transition-all bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-widest uppercase">
                Senha
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm text-slate-900 placeholder:text-slate-300 transition-all font-medium tracking-wider bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 bg-slate-950 text-white rounded-xl hover:bg-black transition-all font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 shadow-lg shadow-slate-950/20 hover:shadow-slate-950/30 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  ENTRANDO...
                </>
              ) : (
                'ENTRAR NO PAINEL'
              )}
            </button>
          </form>

          <div className="text-center mt-12">
            <Link
              to="/public"
              className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Voltar ao site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}