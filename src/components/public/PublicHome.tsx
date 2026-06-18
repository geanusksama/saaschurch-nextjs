import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { User, Play, Radio, Camera, Users, MapPin, Sun, Moon } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { MembroLogin } from '../membro/MembroLogin';
import { MembroProvider } from '../membro/MembroProvider';

function DoveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 3s-3 1-5.5 3c-3 2.5-5.5 6-6.5 8.5-.75.25-1.5.25-2.25 0-.5-.5-1-1.5-1.25-2.75C5.75 9 4.25 8.75 3 9c1.5 1.5 3 2.5 3.5 4.5.5 2 2 3.5 3.5 4.5.5.25.75.75.5 1.25-.25.75-1 1.75-2.5 2.25 1.25-.25 2.25-.75 2.5-1.5.25-.75.75-.75 1.25-.5 1 1 2.5 2.5 4.5 3.5-.25-1.25-.5-2.75-1.25-3.75C16 18.5 19.5 16 22 13.5c2-2 1.5-5.5 0-7.5-1-1-2-1-2.5-1.5.5-1 1-1.5.5-1.5z" />
    </svg>
  );
}

export function PublicHome() {
  const [isDark, setIsDark] = useState(true);
  const [showMembroLogin, setShowMembroLogin] = useState(false);
  const navigate = useNavigate();

  // Lê o tema salvo (compartilhado com a página pública do Peniel)
  useEffect(() => {
    const saved = localStorage.getItem("mrm_public_theme");
    if (saved) setIsDark(saved !== "light");
  }, []);

  // Persiste o tema escolhido para que outras páginas públicas (Peniel) o sigam
  useEffect(() => {
    try { localStorage.setItem("mrm_public_theme", isDark ? "dark" : "light"); } catch { /* ignore */ }
  }, [isDark]);

  const bg        = isDark ? '#0a0a0a' : '#f5f4f0';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSub   = isDark ? 'text-slate-400' : 'text-gray-500';
  const textMuted = isDark ? 'text-slate-500' : 'text-gray-400';
  const border    = isDark ? 'border-slate-600' : 'border-gray-300';
  const iconColor = isDark ? 'text-slate-200' : 'text-gray-600';
  const avatarCls = isDark
    ? 'bg-slate-800 border border-slate-700 hover:bg-slate-700'
    : 'bg-white border border-gray-200 hover:bg-gray-50';

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden font-sans transition-colors duration-500"
      style={{ background: bg }}>

      <style>{`
        .spotlight-left{position:absolute;bottom:-20vh;left:30%;width:150px;height:120vh;background:linear-gradient(to top,rgba(255,255,255,0.03),transparent);transform-origin:bottom center;filter:blur(30px);animation:spotlightLeft 15s ease-in-out infinite}
        .spotlight-right{position:absolute;bottom:-20vh;right:30%;width:150px;height:120vh;background:linear-gradient(to top,rgba(255,255,255,0.03),transparent);transform-origin:bottom center;filter:blur(30px);animation:spotlightRight 18s ease-in-out infinite}
        .comet{position:absolute;width:4px;height:4px;background:rgba(255,255,255,0.6);border-radius:50%;box-shadow:0 0 10px 2px rgba(255,255,255,0.3);opacity:0}
        .comet-1{animation:cometAnim 25s linear infinite 2s;top:-10%;right:20%}
        .comet-2{animation:cometAnimR 30s linear infinite 7s;top:-10%;left:30%}
        .comet-3{animation:cometAnim 35s linear infinite 11s;top:-10%;right:50%}
        @keyframes spotlightLeft{0%,100%{transform:rotate(-35deg)}50%{transform:rotate(15deg)}}
        @keyframes spotlightRight{0%,100%{transform:rotate(35deg)}50%{transform:rotate(-15deg)}}
        @keyframes cometAnim{0%{transform:translate(0,0) rotate(45deg);opacity:0}5%{opacity:1}20%,100%{transform:translate(-100vw,100vh) rotate(45deg);opacity:0}}
        @keyframes cometAnimR{0%{transform:translate(0,0) rotate(-45deg);opacity:0}5%{opacity:1}20%,100%{transform:translate(100vw,100vh) rotate(-45deg);opacity:0}}
        .btn-phone{transition:transform 0.2s,box-shadow 0.2s}
        .btn-phone:hover{transform:scale(1.09)}
        *::-webkit-scrollbar{display:none}
      `}</style>

      {isDark && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="spotlight-left"/><div className="spotlight-right"/>
          <div className="comet comet-1"/><div className="comet comet-2"/><div className="comet comet-3"/>
        </div>
      )}

      <img src="/adcampinas.png" alt=""
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-[80vw] md:w-[50vw] lg:w-[42rem] aspect-square object-cover rounded-full z-0"
        style={{ opacity: isDark ? 0.05 : 0.04, mixBlendMode: isDark ? 'screen' : 'multiply' }} />

      {/* Header */}
      <header className="flex items-center justify-between p-6 md:px-12 relative z-10">
        <img src="/adcampinas.png" alt="AD Campinas" className={`w-12 h-12 md:w-14 md:h-14 rounded-full object-cover opacity-95 hover:opacity-100 transition-opacity ring-1 ${isDark ? 'ring-white/10' : 'ring-black/10'}`} />
        <div className="flex items-center gap-3">
          <button onClick={() => setIsDark(d => !d)} title={isDark ? 'Tema claro' : 'Tema escuro'}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${avatarCls}`}>
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
          {/* <button onClick={() => setShowPortal(true)} title="Portal Digital — Explorar" className="btn-phone relative w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 0 18px rgba(34,197,94,0.55)' }}>
            <Smartphone className="w-5 h-5 text-white" />
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(34,197,94,0.22)' }} />
          </button> */}
          {/* Sou Membro CTA */}
          <button
            onClick={() => setShowMembroLogin(true)}
            title="Área do Membro"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
            style={{ background: '#2dd4bf', color: '#0d0f17', boxShadow: '0 0 18px rgba(45,212,191,0.4)' }}
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:block">Sou Membro</span>
          </button>
          <Link to="/auth/login" className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${avatarCls}`}>
            <User className="w-5 h-5" style={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col md:flex-row items-center justify-center px-6 md:px-24 py-12 relative z-10 gap-16 lg:gap-32">
        <div className="w-full md:w-1/2 max-w-lg">
          <p className={`font-medium mb-2 text-sm tracking-wide ${textMuted}`}>Nossa missão é</p>
          <h1 className={`text-6xl md:text-7xl lg:text-[5.5rem] font-medium mb-8 tracking-tight ${textPrimary}`}>REINAR</h1>
          <p className={`leading-relaxed mb-6 text-sm md:text-base font-light ${textSub}`}>
            Restaurando vidas através do ensino da Palavra, investindo em pessoas,
            nutrindo o conhecimento, para alcançar a cidade e estabelecer o Reino dos Céus.
          </p>
          <p className={`text-xs tracking-wide ${textMuted}`}>João 3:16</p>
        </div>

        <div className="w-full md:w-1/2 max-w-md space-y-8">
          <Link to="/peniel" className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-[#d4af37] transition-colors ${border}`}>
              <DoveIcon className={`w-6 h-6 group-hover:text-[#d4af37] transition-colors ${iconColor}`} />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Inscrições Peniel</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>Um lugar de encontro, fé e transformação.<br />Saiba mais e faça sua inscrição.</p>
            </div>
          </Link>

          <div className="flex items-start gap-5">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center ${border}`}><Users className={`w-6 h-6 ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Dias de culto</h3>
              <div className={`text-xs leading-relaxed space-y-0.5 ${textSub}`}>
                <p><strong className={textPrimary}>Domingo:</strong> 8h EBD, 9:30 e 18:30 Culto da Família</p>
                <p><strong className={textPrimary}>Quarta:</strong> 19:15 Culto de Ensino</p>
                <p><strong className={textPrimary}>Sexta:</strong> 23h Vigília</p>
                <p><strong className={textPrimary}>Sábado:</strong> Manhã - Oração das Mulheres, Noite - Culto de Jovens</p>
              </div>
            </div>
          </div>

          <a href="https://www.youtube.com/@tvadcampinas" target="_blank" rel="noopener noreferrer" className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-[#ff0000] transition-colors ${border}`}><Play className={`w-6 h-6 group-hover:text-[#ff0000] transition-colors ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Culto ao vivo</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>Assista o culto ao vivo pela internet<br />em nosso canal no Youtube</p>
            </div>
          </a>

          <div className="flex items-start gap-5">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center ${border}`}><Radio className={`w-6 h-6 ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>102,9</h3>
              <p className={`text-xs leading-relaxed flex items-center gap-2 ${textSub}`}>Mais FM ao vivo <span className="w-2.5 h-2.5 rounded-full bg-[#00b894] animate-pulse" /></p>
            </div>
          </div>

          <a href="https://www.instagram.com/adcampinas/" target="_blank" rel="noopener noreferrer" className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-pink-500 transition-colors ${border}`}><Camera className={`w-6 h-6 group-hover:text-pink-500 transition-colors ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Instagram</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>Saiba o que está acontecendo, siga-nos<br />nas redes sociais</p>
            </div>
          </a>

          <a href="https://www.google.com/maps/search/?api=1&query=Rua+Barão+de+Parnaíba,+149+-+Campinas" target="_blank" rel="noopener noreferrer" className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-blue-400 transition-colors ${border}`}><MapPin className={`w-6 h-6 group-hover:text-blue-400 transition-colors ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Nossa Sede</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>Rua Barão de Parnaíba, 149 - Campinas<br />Telefone/WhatsApp: (19) 98928-1188</p>
            </div>
          </a>
        </div>
      </main>

      <AnimatePresence>
        {showMembroLogin && (
          <MembroProvider>
            <MembroLogin
              isDark={isDark}
              onClose={() => setShowMembroLogin(false)}
              onSuccess={() => { setShowMembroLogin(false); navigate('/membro/perfil'); }}
            />
          </MembroProvider>
        )}
      </AnimatePresence>
    </div>
  );
}
