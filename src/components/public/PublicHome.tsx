import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  User, Play, Radio, Camera, Users, MapPin,
  Smartphone, Sun, Moon, X,
  BookOpen, Building2, Mic2, Globe,
  Calendar, ShoppingCart, Heart, MessageSquare,
  Star, CalendarDays, Wifi, Battery, Signal,
} from 'lucide-react';

// ─── App icon config (mirrors the real mobile app) ────────────────────────────
const APP_ICONS = [
  { name: 'Bíblia',       Icon: BookOpen,      color: '#6366f1' },
  { name: 'Igreja',       Icon: Building2,     color: '#3b82f6' },
  { name: 'Pregações',    Icon: Mic2,          color: '#8b5cf6' },
  { name: 'Ministério',   Icon: Users,         color: '#059669' },
  { name: 'Site',         Icon: Globe,         color: '#0ea5e9' },
  { name: 'Rádio',        Icon: Radio,         color: '#f59e0b' },
  { name: 'Agenda anual', Icon: Calendar,      color: '#ef4444' },
  { name: 'Eventos',      Icon: CalendarDays,  color: '#ec4899' },
  { name: 'Compras',      Icon: ShoppingCart,  color: '#10b981' },
  { name: 'Pão diário',   Icon: Heart,         color: '#f97316' },
  { name: 'Testemunhos',  Icon: MessageSquare, color: '#6366f1' },
  { name: 'Atend. Past.', Icon: Heart,         color: '#e11d48' },
  { name: 'Liderança',    Icon: Star,          color: '#d97706' },
];

// ─── Realistic iPhone-style phone shell ───────────────────────────────────────
function PhoneShell() {
  const [appDark, setAppDark] = useState(true);
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);

  const bg        = appDark ? '#0f172a' : '#f1f5f9';
  const cardBg    = appDark ? '#1e293b' : '#ffffff';
  const text      = appDark ? '#f1f5f9' : '#1e293b';
  const textSub   = appDark ? '#94a3b8' : '#64748b';
  const divider   = appDark ? '#334155' : '#e2e8f0';
  const statusBg  = appDark ? '#0f172a' : '#f1f5f9';

  return (
    <div className="relative select-none" style={{ width: 310 }}>

      {/* ── Phone body ─────────────────────────────────────────────────────── */}
      <div style={{
        width: 310, height: 660,
        borderRadius: 52,
        background: 'linear-gradient(160deg,#3a3a3c 0%,#1c1c1e 60%,#111 100%)',
        padding: 3,
        boxShadow: [
          '0 0 0 1px rgba(255,255,255,0.10)',
          'inset 0 0 0 1px rgba(255,255,255,0.04)',
          '0 40px 100px rgba(0,0,0,0.85)',
          '0 0 80px rgba(34,197,94,0.12)',
        ].join(','),
      }}>

        {/* ── Screen ─────────────────────────────────────────────────────── */}
        <div style={{
          width: '100%', height: '100%',
          borderRadius: 49,
          overflow: 'hidden',
          background: bg,
          display: 'flex', flexDirection: 'column',
          transition: 'background 0.3s',
        }}>

          {/* Status bar */}
          <div style={{ background: statusBg, padding: '10px 24px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', flexShrink: 0 }}>
            {/* Dynamic Island */}
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 108, height: 28, background: '#000', borderRadius: 20, zIndex: 2 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: text, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <Signal size={11} color={text} />
              <Wifi size={11} color={text} />
              <Battery size={11} color={text} />
            </div>
          </div>

          {/* Scrollable app content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 8px', scrollbarWidth: 'none' }}>

            {/* App header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 700 }}>F</div>
                <div>
                  <p style={{ fontSize: 9, color: textSub, margin: 0 }}>Bom dia</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: text, margin: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Francisco Das Chagas</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {/* Theme toggle inside app */}
                <button
                  onClick={() => setAppDark(d => !d)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: appDark ? '#334155' : '#e2e8f0', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {appDark
                    ? <Sun size={13} color="#f1f5f9" />
                    : <Moon size={13} color="#334155" />}
                </button>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: appDark ? '#334155' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13 }}>🔔</span>
                </div>
              </div>
            </div>

            {/* Icon grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px 8px' }}>
              {APP_ICONS.map(({ name, Icon, color }) => (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                  className="group">
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 12px ${color}44`,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
                  >
                    <Icon size={22} color="#fff" />
                  </div>
                  <span style={{ fontSize: 9, color: text, textAlign: 'center', fontWeight: 500, lineHeight: 1.2 }}>{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom navigation */}
          <div style={{ background: cardBg, borderTop: `1px solid ${divider}`, display: 'flex', padding: '8px 0 14px', flexShrink: 0, transition: 'background 0.3s' }}>
            {[
              { emoji: '☰', label: 'Menu', active: true },
              { emoji: '📷', label: 'Foto', active: false },
              { emoji: '📋', label: 'Histórico', active: false },
              { emoji: '👤', label: 'Perfil', active: false },
            ].map(t => (
              <div key={t.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 17 }}>{t.emoji}</span>
                <span style={{ fontSize: 8, color: t.active ? '#6366f1' : textSub, fontWeight: t.active ? 600 : 400 }}>{t.label}</span>
              </div>
            ))}
          </div>

          {/* Home indicator */}
          <div style={{ height: 20, background: cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 100, height: 4, background: appDark ? '#475569' : '#cbd5e1', borderRadius: 4 }} />
          </div>

        </div>
      </div>

      {/* ── Side buttons (decorative) ─────────────────────────────────────── */}
      {/* Power button - right */}
      <div style={{ position: 'absolute', right: -4, top: 130, width: 4, height: 68, background: 'linear-gradient(180deg,#3a3a3c,#2a2a2c)', borderRadius: '0 3px 3px 0', boxShadow: '1px 0 3px rgba(0,0,0,0.5)' }} />
      {/* Volume buttons - left */}
      <div style={{ position: 'absolute', left: -4, top: 110, width: 4, height: 30, background: 'linear-gradient(180deg,#3a3a3c,#2a2a2c)', borderRadius: '3px 0 0 3px', boxShadow: '-1px 0 3px rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', left: -4, top: 150, width: 4, height: 55, background: 'linear-gradient(180deg,#3a3a3c,#2a2a2c)', borderRadius: '3px 0 0 3px', boxShadow: '-1px 0 3px rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', left: -4, top: 214, width: 4, height: 55, background: 'linear-gradient(180deg,#3a3a3c,#2a2a2c)', borderRadius: '3px 0 0 3px', boxShadow: '-1px 0 3px rgba(0,0,0,0.5)' }} />

      {/* Green glow ring */}
      <div style={{ position: 'absolute', inset: -16, borderRadius: 68, background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: -1 }} />
    </div>
  );
}

// ─── Main Public Homepage ─────────────────────────────────────────────────────
export function PublicHome() {
  const [isDark, setIsDark] = useState(true);
  const [showApp, setShowApp] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!showApp) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowApp(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showApp]);

  // ── Theme values ──────────────────────────────────────────────────────────
  const bg          = isDark ? '#0a0a0a' : '#f5f4f0';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSub     = isDark ? 'text-slate-400' : 'text-gray-500';
  const textMuted   = isDark ? 'text-slate-500' : 'text-gray-400';
  const border      = isDark ? 'border-slate-600' : 'border-gray-300';
  const iconColor   = isDark ? 'text-slate-200' : 'text-gray-600';
  const avatarCls   = isDark
    ? 'bg-slate-800 border border-slate-700 hover:bg-slate-700'
    : 'bg-white border border-gray-200 hover:bg-gray-50';

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden font-sans transition-colors duration-500`}
      style={{ background: bg }}>

      <style>{`
        .spotlight-left {
          position:absolute;bottom:-20vh;left:30%;width:150px;height:120vh;
          background:linear-gradient(to top,rgba(255,255,255,0.03),transparent);
          transform-origin:bottom center;filter:blur(30px);
          animation:spotlightLeft 15s ease-in-out infinite;
        }
        .spotlight-right {
          position:absolute;bottom:-20vh;right:30%;width:150px;height:120vh;
          background:linear-gradient(to top,rgba(255,255,255,0.03),transparent);
          transform-origin:bottom center;filter:blur(30px);
          animation:spotlightRight 18s ease-in-out infinite;
        }
        .comet { position:absolute;width:4px;height:4px;background:rgba(255,255,255,0.6);border-radius:50%;box-shadow:0 0 10px 2px rgba(255,255,255,0.3);opacity:0; }
        .comet-1 { animation:cometAnimation 25s linear infinite 2s;top:-10%;right:20%; }
        .comet-2 { animation:cometAnimationReverse 30s linear infinite 7s;top:-10%;left:30%; }
        .comet-3 { animation:cometAnimation 35s linear infinite 11s;top:-10%;right:50%; }
        @keyframes spotlightLeft { 0%,100%{transform:rotate(-35deg)} 50%{transform:rotate(15deg)} }
        @keyframes spotlightRight { 0%,100%{transform:rotate(35deg)} 50%{transform:rotate(-15deg)} }
        @keyframes cometAnimation { 0%{transform:translate(0,0) rotate(45deg);opacity:0} 5%{opacity:1} 20%,100%{transform:translate(-100vw,100vh) rotate(45deg);opacity:0} }
        @keyframes cometAnimationReverse { 0%{transform:translate(0,0) rotate(-45deg);opacity:0} 5%{opacity:1} 20%,100%{transform:translate(100vw,100vh) rotate(-45deg);opacity:0} }
        @keyframes phonePop { from{transform:scale(0.85) translateY(30px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
        .phone-pop { animation:phonePop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .btn-phone { transition:transform 0.2s,box-shadow 0.2s; }
        .btn-phone:hover { transform:scale(1.08); }
        ::-webkit-scrollbar { display:none; }
      `}</style>

      {/* Animated background (dark only) */}
      {isDark && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="spotlight-left" />
          <div className="spotlight-right" />
          <div className="comet comet-1" />
          <div className="comet comet-2" />
          <div className="comet comet-3" />
        </div>
      )}

      {/* Watermark */}
      <img
        src="/adcampinas.png"
        alt=""
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-[80vw] md:w-[50vw] lg:max-w-2xl object-contain z-0"
        style={{ opacity: isDark ? 0.05 : 0.04, mixBlendMode: isDark ? 'screen' : 'multiply' }}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between p-6 md:px-12 relative z-10">
        <img src="/adcampinas.png" alt="AD Campinas"
          className="h-10 md:h-12 object-contain opacity-90 hover:opacity-100 transition-opacity"
          style={{ mixBlendMode: 'screen' }} />

        <div className="flex items-center gap-3">
          {/* Dark / Light toggle */}
          <button
            onClick={() => setIsDark(d => !d)}
            title={isDark ? 'Tema claro' : 'Tema escuro'}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${avatarCls}`}>
            {isDark
              ? <Sun className="w-4 h-4 text-amber-400" />
              : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Mobile app preview — green glowing button */}
          <button
            onClick={() => setShowApp(true)}
            title="Ver App Mobile"
            className="btn-phone relative w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              boxShadow: '0 0 18px rgba(34,197,94,0.55), 0 0 6px rgba(34,197,94,0.3)',
            }}>
            <Smartphone className="w-5 h-5 text-white" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full animate-ping"
              style={{ background: 'rgba(34,197,94,0.25)' }} />
          </button>

          {/* Login */}
          <Link to="/auth/login"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${avatarCls}`}>
            <User className="w-5 h-5" style={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
          </Link>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col md:flex-row items-center justify-center px-6 md:px-24 py-12 relative z-10 gap-16 lg:gap-32">

        {/* Left — Missão */}
        <div className="w-full md:w-1/2 max-w-lg">
          <p className={`font-medium mb-2 text-sm tracking-wide ${textMuted}`}>Nossa missão é</p>
          <h1 className={`text-6xl md:text-7xl lg:text-[5.5rem] font-medium mb-8 tracking-tight ${textPrimary}`}>
            REINAR
          </h1>
          <p className={`leading-relaxed mb-6 text-sm md:text-base font-light ${textSub}`}>
            Restaurando vidas através do ensino da Palavra, investindo em pessoas,
            nutrindo o conhecimento, para alcançar a cidade e estabelecer o Reino dos Céus.
          </p>
          <p className={`text-xs tracking-wide ${textMuted}`}>João 3:16</p>
        </div>

        {/* Right — Info links */}
        <div className="w-full md:w-1/2 max-w-md space-y-8">

          <div className="flex items-start gap-5">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center ${border}`}>
              <Users className={`w-6 h-6 ${iconColor}`} />
            </div>
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

          <a href="https://www.youtube.com/@tvadcampinas" target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-[#ff0000] transition-colors ${border}`}>
              <Play className={`w-6 h-6 group-hover:text-[#ff0000] transition-colors ${iconColor}`} />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Culto ao vivo</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>
                Assista o culto ao vivo pela internet<br />em nosso canal no Youtube
              </p>
            </div>
          </a>

          <div className="flex items-start gap-5">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center ${border}`}>
              <Radio className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>102,9</h3>
              <p className={`text-xs leading-relaxed flex items-center gap-2 ${textSub}`}>
                Mais FM ao vivo
                <span className="w-2.5 h-2.5 rounded-full bg-[#00b894] animate-pulse" />
              </p>
            </div>
          </div>

          <a href="https://www.instagram.com/adcampinas/" target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-pink-500 transition-colors ${border}`}>
              <Camera className={`w-6 h-6 group-hover:text-pink-500 transition-colors ${iconColor}`} />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Instagram</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>
                Saiba o que está acontecendo, siga-nos<br />nas redes sociais
              </p>
            </div>
          </a>

          <a href="https://www.google.com/maps/search/?api=1&query=Rua+Barão+de+Parnaíba,+149+-+Campinas" target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-5 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-blue-400 transition-colors ${border}`}>
              <MapPin className={`w-6 h-6 group-hover:text-blue-400 transition-colors ${iconColor}`} />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Nossa Sede</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>
                Rua Barão de Parnaíba, 149 - Campinas<br />
                Telefone/WhatsApp: (19) 98928-1188
              </p>
            </div>
          </a>

        </div>
      </main>

      {/* ── Mobile App Preview overlay ──────────────────────────────────────── */}
      {showApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)' }}
          onClick={() => setShowApp(false)}>

          <div className="flex flex-col items-center gap-5" onClick={e => e.stopPropagation()}>

            {/* Label above phone */}
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-xs tracking-widest uppercase">Preview do App</span>
              <span className="text-green-400 text-xs tracking-widest uppercase font-semibold">● Ao Vivo</span>
            </div>

            {/* Phone */}
            <div className="phone-pop">
              <PhoneShell />
            </div>

            {/* Close */}
            <button
              onClick={() => setShowApp(false)}
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors mt-1">
              <X size={14} /> Fechar (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
