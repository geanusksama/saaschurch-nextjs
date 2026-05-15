import { Link, useNavigate } from 'react-router';
import { Mail, Lock, User, Phone, Eye, EyeOff, Loader, MapPinned } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

import { apiBase } from '../../lib/apiBase';

type CampoOption = {
  id: string;
  name: string;
  code?: string | null;
};

export function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [campos, setCampos] = useState<CampoOption[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [campoId, setCampoId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadCampos = async () => {
      try {
        const response = await fetch(`${apiBase}/campos`);
        if (!response.ok) {
          throw new Error(`Erro ${response.status} ao carregar campos.`);
        }

        const data = await response.json();
        setCampos(Array.isArray(data) ? data : []);
      } catch (loadError: any) {
        setError(loadError.message || 'Não foi possível carregar os campos disponíveis.');
      }
    };

    loadCampos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!campoId) {
      setError('Selecione o campo antes de criar a conta.');
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          profile_type: 'pending',
          campo_id: campoId,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess('Conta criada! Aguarde a ativação do seu perfil por um administrador.');
    setLoading(false);
    setTimeout(() => navigate('/pending-activation'), 1200);
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
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-emerald-500 rounded text-white flex items-center justify-center font-bold text-lg">
              M
            </div>
            <span className="text-slate-900 font-extrabold tracking-widest text-sm uppercase">MRM GESTÃO</span>
          </div>

          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#0f172a] mb-2 tracking-tight">Criar Conta</h2>
          <p className="text-sm text-slate-500 mb-10">Junte-se à nossa comunidade.</p>

          {/* Tabs */}
          <div className="flex gap-2 mb-10">
            <Link to="/auth/login" className="px-5 py-2 bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-full transition-colors tracking-wide">
              ENTRAR
            </Link>
            <div className="px-5 py-2 bg-slate-950 text-white text-xs font-bold rounded-full cursor-default tracking-wide shadow-sm shadow-slate-950/20">
              CRIAR CONTA
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-widest uppercase">
                Nome Completo
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="text"
                  placeholder="João Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm text-slate-900 placeholder:text-slate-300 transition-all bg-white"
                  required
                />
              </div>
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-widest uppercase">
                  Telefone
                </label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="tel"
                    placeholder="(11) 98765-4321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm text-slate-900 placeholder:text-slate-300 transition-all bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-widest uppercase">
                  Campo
                </label>
                <div className="relative group">
                  <MapPinned className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <select
                    value={campoId}
                    onChange={(e) => setCampoId(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm text-slate-900 transition-all bg-white appearance-none"
                    required
                  >
                    <option value="" disabled hidden>Selecione seu campo</option>
                    {campos.map((campo) => (
                      <option key={campo.id} value={campo.id}>
                        {campo.name}
                      </option>
                    ))}
                  </select>
                </div>
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
              <p className="text-[10px] text-slate-400 mt-2 tracking-wide uppercase">Mínimo 8 caracteres</p>
            </div>

            <div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    className="w-5 h-5 border-2 border-slate-300 rounded focus:ring-0 focus:ring-offset-0 text-slate-900 transition-colors cursor-pointer appearance-none checked:bg-slate-900 checked:border-slate-900"
                    required
                  />
                  <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 14 10" fill="none">
                    <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm text-slate-500 group-hover:text-slate-700 transition-colors">
                  Eu aceito os{' '}
                  <Link to="/terms" className="text-slate-900 hover:underline font-semibold">
                    Termos de Uso
                  </Link>{' '}
                  e{' '}
                  <Link to="/privacy" className="text-slate-900 hover:underline font-semibold">
                    Política de Privacidade
                  </Link>
                </span>
              </label>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 animate-in fade-in slide-in-from-top-1">
                {success}
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
                  CRIANDO CONTA...
                </>
              ) : (
                'CRIAR CONTA'
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
