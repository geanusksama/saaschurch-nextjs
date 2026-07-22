import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { User, Play, Radio, Camera, Users, MapPin, Sun, Moon, MessageSquare, Info, HeartHandshake, Calendar, Check, AlertCircle, Sparkles, BookOpen, X, Loader2, LogIn, DollarSign, Briefcase, Laptop, Heart, Baby } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MembroLogin } from '../membro/MembroLogin';
import { MembroProvider } from '../membro/MembroProvider';
import { PenielRegistrationModal } from './PenielRegistrationModal';
import { apiBase } from '../../lib/apiBase';
import { toast } from 'sonner';

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

interface FloatingItem {
  id: number;
  type: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  fadeDuration: number;
  fadeDelay: number;
  color: string;
  peak: number;
}

// Total de símbolos bíblicos disponíveis (0..TOTAL-1)
const BIBLICAL_SYMBOL_COUNT = 12;

// Paleta de cores suaves para os símbolos (alternam entre os elementos)
const BIBLICAL_COLORS = [
  '#d4af37', // dourado
  '#22c55e', // esmeralda
  '#38bdf8', // azul céu
  '#f59e0b', // âmbar
  '#a78bfa', // violeta
  '#2dd4bf', // teal
  '#f472b6', // rosa
  '#e2e8f0', // claro
];

function BiblicalFloatingElements({ isDark }: { isDark: boolean }) {
  const [items, setItems] = useState<FloatingItem[]>([]);

  useEffect(() => {
    const generated: FloatingItem[] = [];
    // Mais elementos para uma amostragem maior alternando na tela
    for (let i = 0; i < 14; i++) {
      generated.push({
        id: i,
        type: i % BIBLICAL_SYMBOL_COUNT,
        left: Math.random() * 85 + 5,
        top: Math.random() * 80 + 10,
        size: Math.floor(Math.random() * 30) + 38,
        duration: Math.floor(Math.random() * 15) + 20,
        delay: Math.floor(Math.random() * 8),
        // Ciclo de aparecer/sumir (fade) defasado por elemento
        fadeDuration: Math.floor(Math.random() * 8) + 9,
        fadeDelay: Math.floor(Math.random() * 10),
        color: BIBLICAL_COLORS[i % BIBLICAL_COLORS.length],
        // Opacidade de pico (mais visível que antes, mas sem competir com o texto)
        peak: (isDark ? 0.16 : 0.12) + Math.random() * 0.1,
      });
    }
    setItems(generated);
  }, [isDark]);

  const renderSvgContent = (type: number) => {
    switch (type) {
      case 0: // Ark of Noah
        return <path d="M10 60 C20 85, 80 85, 90 60 C80 60, 20 60, 10 60 Z M30 60 L30 45 L70 45 L70 60 M30 45 L50 35 L70 45 M5 75 C20 70, 30 80, 50 75 C70 70, 80 80, 95 75" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 1: // Cross of Calvary
        return <path d="M50 10 L50 90 M25 35 L75 35" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
      case 2: // Bible
        return <path d="M15 25 C30 15, 45 25, 50 25 C55 25, 70 15, 85 25 L85 75 C70 65, 55 75, 50 75 C45 75, 30 65, 15 75 Z M50 25 L50 75 M30 40 L35 40 M30 50 L40 50 M30 60 L35 60 M65 40 L70 40 M60 50 L70 50 M65 60 L70 60" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 3: // Ichthys Fish
        return <path d="M10 50 C30 30, 70 30, 90 50 C70 70, 30 70, 10 50 Z M90 50 L95 40 L85 50 L95 60 Z" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 4: // Anchor
        return <path d="M50 15 A 6 6 0 1 1 50 27 A 6 6 0 1 1 50 15 M50 27 L50 80 M30 55 L70 55 M20 60 C30 85, 70 85, 80 60 M15 62 L25 58 M75 58 L85 62" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 5: // Lamb
        return <path d="M25 65 C20 65, 15 60, 15 50 C15 45, 20 40, 30 40 C32 35, 38 30, 45 30 C50 30, 55 35, 57 40 C62 40, 67 45, 67 52 C67 60, 60 65, 50 65 Z M30 65 L30 75 M45 65 L45 75 M55 65 L55 75 M20 50 L20 75 M65 42 C70 40, 75 42, 78 48 C80 52, 78 56, 74 58" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 6: // Cup and Bread
        return <path d="M25 40 L35 40 M30 40 C30 60, 60 60, 60 40 M45 56 L45 75 M35 75 L55 75 M62 65 C68 58, 82 58, 88 65 C85 72, 65 72, 62 65 Z" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 7: // Dove (Holy Spirit)
        return <path d="M18 52 C30 44, 44 42, 58 48 C66 38, 82 36, 90 46 C82 48, 78 53, 76 59 C83 63, 80 73, 71 75 C68 66, 56 62, 46 63 C34 64, 24 60, 18 52 Z M58 48 L54 32 M54 32 L62 38 M54 32 L46 39" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 8: // Crown
        return <path d="M20 70 L24 36 L38 54 L50 30 L62 54 L76 36 L80 70 Z M20 72 L80 72 M20 80 L80 80 M38 54 L38 54 M50 30 L50 30" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 9: // Flame (fire / Pentecost)
        return <path d="M50 12 C40 34, 28 44, 34 62 C38 76, 46 84, 50 86 C54 84, 62 76, 66 62 C72 44, 60 34, 50 12 Z M50 52 C45 60, 47 72, 50 78 C53 72, 55 60, 50 52 Z" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 10: // Star of David
        return <path d="M50 14 L72 58 L28 58 Z M50 86 L28 42 L72 42 Z" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 11: // Candle / light
        return <path d="M44 46 L56 46 L56 82 L44 82 Z M38 82 L62 82 M50 46 C46 38, 50 28, 50 28 C50 28, 54 38, 50 46 Z M50 22 L50 28" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute"
          style={{
            left: `${item.left}%`,
            top: `${item.top}%`,
            width: `${item.size}px`,
            height: `${item.size}px`,
            color: item.color,
            opacity: 0,
            // Movimento de flutuação + ciclo de fade (aparecer/sumir) defasado
            animationName: `float-v${(item.id % 4) + 1}, biblical-fade`,
            animationDuration: `${item.duration}s, ${item.fadeDuration}s`,
            animationDelay: `${item.delay}s, ${item.fadeDelay}s`,
            animationTimingFunction: 'ease-in-out, ease-in-out',
            animationIterationCount: 'infinite, infinite',
            ['--peak' as any]: item.peak,
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {renderSvgContent(item.type)}
          </svg>
        </div>
      ))}
    </div>
  );
}

const COMMON_CHURCHES = [
  'Assembléia de Deus',
  'Igreja Batista',
  'Igreja Presbiteriana',
  'Igreja do Evangelho Quadrangular',
  'Congregação Cristã no Brasil',
  'Igreja Adventista',
  'Igreja Mundial do Poder de Deus',
  'Igreja Universal do Reino de Deus',
  'Igreja Metodista',
];


const FAB_OPTIONS = [
  { id: 'membro_login', label: 'Já sou Membro', icon: LogIn, color: 'bg-blue-600' },
  { id: 'membership', label: 'Quero ser Membro', icon: Users, color: 'bg-amber-600' },
  { id: 'visita_pastoral', label: 'Visita Pastoral', icon: MapPin, color: 'bg-emerald-600' },
  { id: 'aconselhamento', label: 'Aconselhamento', icon: HeartHandshake, color: 'bg-emerald-600' },
  { id: 'pedido_oracao', label: 'Pedido de Oração', icon: Sparkles, color: 'bg-emerald-600' },
  { id: 'emergencial', label: 'Atendimento Emergencial', icon: AlertCircle, color: 'bg-rose-600' },
  { id: 'reconciliacao', label: 'Reconciliação', icon: HeartHandshake, color: 'bg-emerald-600' },
  { id: 'familiar', label: 'Atendimento Familiar', icon: Users, color: 'bg-emerald-600' },
  { id: 'jovem', label: 'Atendimento Jovem', icon: Sun, color: 'bg-emerald-600' },
  { id: 'infantil', label: 'Atendimento Infantil', icon: Moon, color: 'bg-emerald-600' },
  { id: 'financeiro', label: 'Atendimento Financeiro', icon: DollarSign, color: 'bg-emerald-600' },
  { id: 'ministerial', label: 'Atendimento Ministerial', icon: Briefcase, color: 'bg-emerald-600' },
  { id: 'online', label: 'Atendimento Online', icon: Laptop, color: 'bg-emerald-600' },
  { id: 'presencial', label: 'Atendimento Presencial', icon: MapPin, color: 'bg-emerald-600' },
  { id: 'casamento', label: 'Casamento', icon: Heart, color: 'bg-emerald-600' },
  { id: 'apresentacao_criancas', label: 'Apresentação de Crianças', icon: Baby, color: 'bg-emerald-600' },
];

export function PublicHome() {
  const [isDark, setIsDark] = useState(true);
  const [showMembroLogin, setShowMembroLogin] = useState(false);
  const [showPenielModal, setShowPenielModal] = useState(false);
  const [showFabModal, setShowFabModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<'options' | 'pastoral' | 'membership' | 'otp' | 'scheduler' | 'success'>('options');
  const [otpFlow, setOtpFlow] = useState<'pastoral' | 'membership'>('pastoral');
  
  // Form States
  const [visitorName, setVisitorName] = useState('');
  const [phone, setPhone] = useState('');
  const [attendanceType, setAttendanceType] = useState('visita_pastoral');
  const [notes, setNotes] = useState('');
  
  // Membership Form States
  const [isMarried, setIsMarried] = useState(false);
  const [selectedPastChurches, setSelectedPastChurches] = useState<string[]>([]);
  const [afroBackgrounds, setAfroBackgrounds] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  
  // OTP challenge state
  const [otpToken, setOtpToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [formError, setFormError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ date?: string; position?: number }>({});

  const navigate = useNavigate();

  // Lê o tema salvo (compartilhado com a página pública do Peniel)
  useEffect(() => {
    const saved = localStorage.getItem("mrm_theme_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setIsDark(parsed.isDark !== false);
      } catch {
        setIsDark(true);
      }
    }
  }, []);

  // Persiste o tema escolhido para que outras páginas públicas (Peniel) o sigam
  useEffect(() => {
    try {
      localStorage.setItem("mrm_theme_settings", JSON.stringify({ isDark }));
    } catch { /* ignore */ }
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

  const modalBg = isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200';

  // Available dates for scheduler (next 15 days, excluding sundays)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 20; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() !== 0) { // Exclude Sundays
        dates.push(d);
      }
    }
    return dates;
  };

  const handleSendOtp = async () => {
    if (!visitorName.trim() || !phone.trim()) {
      setFormError('Por favor, preencha o seu nome e telefone.');
      return;
    }
    setFormError('');
    setLoadingOtp(true);
    try {
      const res = await fetch(`${apiBase}/public/pastoral/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar OTP');
      setOtpToken(data.otp_token);
      setOtpError('');
      setOtpCode('');
      setActiveForm('otp');
    } catch (e: any) {
      setFormError(e.message || 'Erro ao iniciar verificação.');
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) {
      setOtpError('O código deve conter 6 dígitos.');
      return;
    }
    setOtpError('');
    setLoadingOtp(true);
    try {
      if (otpFlow === 'pastoral') {
        const res = await fetch(`${apiBase}/public/pastoral/create-attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: visitorName,
            phone,
            type: attendanceType,
            notes,
            otp_token: otpToken,
            code: otpCode,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar atendimento');
        
        setSuccessInfo({});
        setActiveForm('success');
      } else {
        // Go to calendar scheduler
        setActiveForm('scheduler');
      }
    } catch (e: any) {
      setOtpError(e.message || 'Código incorreto ou inválido.');
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleConfirmSchedule = async (dateStr: string) => {
    setLoadingOtp(true);
    try {
      const pastChurchesStr = selectedPastChurches.join(', ');
      const afroStr = afroBackgrounds.join(', ');
      const res = await fetch(`${apiBase}/public/pastoral/create-membership-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: visitorName,
          whatsapp: phone,
          isMarried,
          pastChurches: pastChurchesStr,
          afroBackground: afroBackgrounds.length > 0,
          scheduledDate: dateStr,
          otp_token: otpToken,
          code: otpCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao agendar');
      
      setSuccessInfo({
        date: new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR'),
        position: data.position,
      });
      setActiveForm('success');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao realizar agendamento.');
    } finally {
      setLoadingOtp(false);
    }
  };

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
        
        /* Estilos globais para forçar cores de texto corretas nos inputs e selects em modo escuro/claro */
        select, input, textarea {
          color: ${isDark ? '#ffffff' : '#1e293b'} !important;
          background-color: ${isDark ? '#1e293b' : '#f8fafc'} !important;
        }
        select option {
          background-color: ${isDark ? '#1e293b' : '#ffffff'} !important;
          color: ${isDark ? '#ffffff' : '#1e293b'} !important;
        }
        input::placeholder, textarea::placeholder {
          color: ${isDark ? '#94a3b8' : '#6b7280'} !important;
          opacity: 0.8 !important;
        }

        /* Biblical Floating background styles */
        .animate-float-v1 {
          animation-name: float-v1;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .animate-float-v2 {
          animation-name: float-v2;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .animate-float-v3 {
          animation-name: float-v3;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .animate-float-v4 {
          animation-name: float-v4;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes float-v1 {
          0% { transform: translate(0px, 0px) rotate(0deg); }
          25% { transform: translate(15px, -20px) rotate(3deg) scale(1.01); }
          50% { transform: translate(-10px, -45px) rotate(-4deg) scale(0.99); }
          75% { transform: translate(-25px, -20px) rotate(2deg) scale(1); }
          100% { transform: translate(0px, 0px) rotate(0deg); }
        }
        @keyframes float-v2 {
          0% { transform: translate(0px, 0px) rotate(0deg); }
          25% { transform: translate(-20px, -25px) rotate(-4deg) scale(0.99); }
          50% { transform: translate(15px, -50px) rotate(6deg) scale(1.02); }
          75% { transform: translate(30px, -25px) rotate(-2deg) scale(1); }
          100% { transform: translate(0px, 0px) rotate(0deg); }
        }
        @keyframes float-v3 {
          0% { transform: translate(0px, 0px) rotate(0deg); }
          25% { transform: translate(25px, -15px) rotate(5deg) scale(1.02); }
          50% { transform: translate(-5px, -40px) rotate(-6deg) scale(0.98); }
          75% { transform: translate(-20px, -15px) rotate(3deg) scale(1.01); }
          100% { transform: translate(0px, 0px) rotate(0deg); }
        }
        @keyframes float-v4 {
          0% { transform: translate(0px, 0px) rotate(0deg); }
          25% { transform: translate(-15px, -30px) rotate(-6deg) scale(0.98); }
          50% { transform: translate(20px, -55px) rotate(8deg) scale(1.02); }
          75% { transform: translate(-10px, -30px) rotate(-4deg) scale(0.99); }
          100% { transform: translate(0px, 0px) rotate(0deg); }
        }
        /* Ciclo de aparecer/sumir dos símbolos (um some, outro aparece) */
        @keyframes biblical-fade {
          0%, 100% { opacity: 0; }
          50% { opacity: var(--peak, 0.2); }
        }
      `}</style>

      {isDark && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="spotlight-left"/><div className="spotlight-right"/>
          <div className="comet comet-1"/><div className="comet comet-2"/><div className="comet comet-3"/>
        </div>
      )}

      {/* Elegant Biblical Floating Elements Background */}
      <BiblicalFloatingElements isDark={isDark} />

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

        <div className="w-full md:w-1/2 max-w-xl grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-7">

          {/* 1. Inscrições Peniel — Swapped to FIRST grid position */}
          <button onClick={() => setShowPenielModal(true)} className="flex items-start gap-4 group hover:opacity-80 transition-opacity text-left">
            <div className="flex-shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors"
              style={{ borderColor: '#d4af37', background: 'rgba(212,175,55,0.08)' }}>
              <DoveIcon className="w-6 h-6 transition-colors" style={{ color: '#d4af37' }} />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Inscrições Peniel e consultar inscrições</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>Um lugar de encontro, fé e transformação.<br />Faça sua inscrição ou consulte uma já realizada.</p>
            </div>
          </button>

          {/* 2. Sou Membro — destaque verde pulsante para chamar atenção */}
          <button onClick={() => setShowMembroLogin(true)}
            className="flex items-start gap-4 group hover:opacity-80 transition-opacity text-left">
            <div className="flex-shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors animate-pulse"
              style={{ borderColor: '#22c55e', background: 'rgba(34,197,94,0.12)', boxShadow: '0 0 16px rgba(34,197,94,0.45)' }}>
              <User className="w-6 h-6" style={{ color: '#22c55e' }} />
            </div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Sou Membro</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>Acesse sua área exclusiva<br />de membro da igreja.</p>
            </div>
          </button>

          <a href="https://www.youtube.com/@tvadcampinas" target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-[#ff0000] transition-colors ${border}`}><Play className={`w-6 h-6 group-hover:text-[#ff0000] transition-colors ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Culto ao vivo</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>Assista o culto ao vivo pela internet<br />em nosso canal no Youtube</p>
            </div>
          </a>

          <a href="https://maisfm1029.com.br/" target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-[#00b894] transition-colors ${border}`}><Radio className={`w-6 h-6 group-hover:text-[#00b894] transition-colors ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>102,9</h3>
              <p className={`text-xs leading-relaxed flex items-center gap-2 ${textSub}`}>Mais FM ao vivo <span className="w-2.5 h-2.5 rounded-full bg-[#00b894] animate-pulse" /></p>
            </div>
          </a>



          <a href="https://www.instagram.com/adcampinas/" target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-pink-500 transition-colors ${border}`}><Camera className={`w-6 h-6 group-hover:text-pink-500 transition-colors ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Instagram</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>Saiba o que está acontecendo, siga-nos<br />nas redes sociais</p>
            </div>
          </a>

          <a href="https://www.google.com/maps/search/?api=1&query=Rua+Barão+de+Parnaíba,+149+-+Campinas" target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 group hover:opacity-80 transition-opacity">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center group-hover:border-blue-400 transition-colors ${border}`}><MapPin className={`w-6 h-6 group-hover:text-blue-400 transition-colors ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Nossa Sede</h3>
              <p className={`text-xs leading-relaxed ${textSub}`}>Rua Barão de Parnaíba, 149 - Campinas<br />Telefone/WhatsApp: (19) 98928-1188</p>
            </div>
          </a>

          <div className="flex items-start gap-4 lg:col-span-2">
            <div className={`flex-shrink-0 w-14 h-14 rounded-full border flex items-center justify-center ${border}`}><Users className={`w-6 h-6 ${iconColor}`} /></div>
            <div className="flex flex-col justify-center min-h-[3.5rem]">
              <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Dias de culto</h3>
              <div className={`text-xs leading-relaxed space-y-0.5 ${textSub}`}>
                <p><strong className={textPrimary}>Domingo:</strong> 8h EBD, 9:30 e 18:30 Culto da Família</p>
                <p><strong className={textPrimary}>Quarta:</strong> 19:15 Culto de Ensino &nbsp;·&nbsp; <strong className={textPrimary}>Sexta:</strong> 23h Vigília</p>
                <p><strong className={textPrimary}>Sábado:</strong> Manhã - Oração das Mulheres, Noite - Culto de Jovens</p>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Floating Action Button (FAB) and Menu Stack */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Floating Menu Stack */}
        <AnimatePresence>
          {fabOpen && (
            <>
              {/* Backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setFabOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-30"
              />
              
              {/* Menu Container */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="z-40 grid grid-cols-1 sm:grid-cols-2 gap-3 justify-items-end max-h-[70vh] max-w-[95vw] sm:max-w-2xl overflow-y-auto pr-1 pb-2 no-scrollbar"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {FAB_OPTIONS.map((opt, index) => {
                  const Icon = opt.icon;
                  return (
                    <motion.div
                      key={opt.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        transition: { delay: (FAB_OPTIONS.length - 1 - index) * 0.02 }
                      }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => {
                        setFabOpen(false);
                        setVisitorName('');
                        setPhone('');
                        setNotes('');
                        setSelectedPastChurches([]);
                        setAfroBackgrounds([]);
                        setFormError('');
                        
                        if (opt.id === 'membro_login') {
                          setShowMembroLogin(true);
                        } else if (opt.id === 'membership') {
                          setOtpFlow('membership');
                          setActiveForm('membership');
                          setShowFabModal(true);
                        } else {
                          setOtpFlow('pastoral');
                          setAttendanceType(opt.id);
                          setActiveForm('pastoral');
                          setShowFabModal(true);
                        }
                      }}
                    >
                      {/* Label badge */}
                      <span className={`px-3 py-1.5 rounded-lg shadow-md text-xs font-semibold whitespace-nowrap transition-transform group-hover:-translate-x-1 ${
                        isDark 
                          ? 'bg-slate-800/90 text-white border border-slate-700/50 backdrop-blur-sm' 
                          : 'bg-white/90 text-slate-800 border border-slate-200/50 backdrop-blur-sm'
                      }`}>
                        {opt.label}
                      </span>
                      
                      {/* Round Icon Button */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 ${opt.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Toggle Button */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 z-40"
          style={{
            background: 'linear-gradient(135deg,#059669,#10b981)',
            boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
          }}
        >
          {!fabOpen && <span className="absolute inset-0 rounded-full animate-ping bg-emerald-500/20" />}
          <motion.div
            animate={{ rotate: fabOpen ? 90 : 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            {fabOpen ? <X className="w-6 h-6 text-white" /> : <MessageSquare className="w-6 h-6 text-white" />}
          </motion.div>
        </button>
      </div>

      {/* FAB Drawer Modal */}
      <AnimatePresence>
        {showFabModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowFabModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl overflow-hidden z-10 transition-all duration-300 ${modalBg}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-emerald-500" />
                  <h2 className={`font-bold text-lg ${textPrimary}`}>
                    {activeForm === 'options' && 'Atendimento AD Campinas'}
                    {activeForm === 'pastoral' && 'Solicitar Atendimento'}
                    {activeForm === 'membership' && 'Quero ser Membro'}
                    {activeForm === 'otp' && 'Verificação de WhatsApp'}
                    {activeForm === 'scheduler' && 'Agende seu Atendimento'}
                    {activeForm === 'success' && 'Solicitação Enviada!'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowFabModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-500/10 text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              {activeForm === 'options' && (
                <div className="space-y-4 py-2">
                  <p className={`text-xs ${textSub} leading-relaxed`}>
                    Olá! Selecione uma das opções abaixo para entrar em contato com a equipe pastoral de nossa igreja.
                  </p>
                  
                  <button
                    onClick={() => {
                      setOtpFlow('pastoral');
                      setActiveForm('pastoral');
                    }}
                    className="flex items-center gap-4 w-full p-4 rounded-xl border text-left hover:scale-[1.01] transition-transform duration-200"
                    style={{ borderColor: isDark ? '#334155' : '#e2e8f0', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-500 flex-shrink-0">
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${textPrimary}`}>Solicitar Atendimento Pastoral</p>
                      <p className="text-[11px] text-slate-400 leading-tight">Aconselhamento, visita pastoral, oração.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setOtpFlow('membership');
                      setActiveForm('membership');
                    }}
                    className="flex items-center gap-4 w-full p-4 rounded-xl border text-left hover:scale-[1.01] transition-transform duration-200"
                    style={{ borderColor: isDark ? '#334155' : '#e2e8f0', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-500 flex-shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${textPrimary}`}>Quero ser Membro</p>
                      <p className="text-[11px] text-slate-400 leading-tight">Faça o seu cadastro para se tornar membro.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowFabModal(false);
                      setShowMembroLogin(true);
                    }}
                    className="flex items-center gap-4 w-full p-4 rounded-xl border text-left hover:scale-[1.01] transition-transform duration-200"
                    style={{ borderColor: isDark ? '#334155' : '#e2e8f0', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/10 text-blue-500 flex-shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${textPrimary}`}>Já sou Membro</p>
                      <p className="text-[11px] text-slate-400 leading-tight">Acesse o portal exclusivo do membro.</p>
                    </div>
                  </button>
                </div>
              )}

              {activeForm === 'pastoral' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Seu Nome *</label>
                    <input
                      type="text"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="Nome completo"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                      WhatsApp *
                      <div className="group relative cursor-pointer text-slate-400 hover:text-emerald-500">
                        <Info size={13} />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-300 z-50 leading-relaxed shadow-lg">
                          🔐 Seus dados estão seguros e o contato é apenas para comunicação interna.
                        </span>
                      </div>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(19) 99999-9999"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Atendimento *</label>
                    <select
                      value={attendanceType}
                      onChange={(e) => setAttendanceType(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    >
                      <option value="visita_pastoral">Visita Pastoral</option>
                      <option value="aconselhamento">Aconselhamento</option>
                      <option value="pedido_oracao">Pedido de Oração</option>
                      <option value="emergencial">Atendimento Emergencial</option>
                      <option value="reconciliacao">Reconciliação</option>
                      <option value="familiar">Atendimento Familiar</option>
                      <option value="jovem">Atendimento Jovem</option>
                      <option value="infantil">Atendimento Infantil</option>
                      <option value="financeiro">Atendimento Financeiro</option>
                      <option value="ministerial">Atendimento Ministerial</option>
                      <option value="online">Atendimento Online</option>
                      <option value="presencial">Atendimento Presencial</option>
                      <option value="casamento">Casamento</option>
                      <option value="apresentacao_criancas">Apresentação de Crianças</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Sua Mensagem / Observações</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Descreva brevemente seu pedido de atendimento..."
                      rows={3}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  {formError && (
                    <div className="text-red-500 text-xs flex items-center gap-1.5">
                      <AlertCircle size={13} /> {formError}
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-3">
                    <button
                      onClick={() => setActiveForm('options')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'}`}
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleSendOtp}
                      disabled={loadingOtp}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md"
                    >
                      {loadingOtp ? <Loader2 size={13} className="animate-spin" /> : 'Confirmar e Avançar'}
                    </button>
                  </div>
                </div>
              )}

              {activeForm === 'membership' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                      WhatsApp *
                      <div className="group relative cursor-pointer text-slate-400 hover:text-emerald-500">
                        <Info size={13} />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-300 z-50 leading-relaxed shadow-lg">
                          🔐 Seus dados estão seguros e o contato é apenas para comunicação interna.
                        </span>
                      </div>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(19) 99999-9999"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Estado Civil *</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio" checked={isMarried} onChange={() => setIsMarried(true)}
                          className="accent-emerald-600"
                        />
                        <span className={isDark ? 'text-white' : 'text-slate-700'}>Casado(a)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio" checked={!isMarried} onChange={() => setIsMarried(false)}
                          className="accent-emerald-600"
                        />
                        <span className={isDark ? 'text-white' : 'text-slate-700'}>Solteiro(a)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">De qual igreja evangélica você já participou?</label>
                    <select
                      value={selectedPastChurches[0] || ''}
                      onChange={(e) => setSelectedPastChurches(e.target.value ? [e.target.value] : [])}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    >
                      <option value="">Nenhuma / Nunca participei</option>
                      {COMMON_CHURCHES.map((ch) => (
                        <option key={ch} value={ch}>{ch}</option>
                      ))}
                      <option value="Outra">Outra (especificar na observação)</option>
                    </select>
                  </div>



                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Observações adicionais</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Alguma informação adicional que deseja compartilhar..."
                      rows={2}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  {formError && (
                    <div className="text-red-500 text-xs flex items-center gap-1.5">
                      <AlertCircle size={13} /> {formError}
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-3">
                    <button
                      onClick={() => setActiveForm('options')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'}`}
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleSendOtp}
                      disabled={loadingOtp}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md"
                    >
                      {loadingOtp ? <Loader2 size={13} className="animate-spin" /> : 'Confirmar e Avançar'}
                    </button>
                  </div>
                </div>
              )}

              {activeForm === 'otp' && (
                <div className="space-y-4 py-2">
                  <p className={`text-xs text-center leading-relaxed ${textSub}`}>
                    Enviamos um código de 6 dígitos via WhatsApp para:<br />
                    <strong className={textPrimary}>{phone}</strong>
                  </p>
                  
                  <div>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className={`w-full tracking-[1.5em] text-center font-bold px-4 py-3 rounded-xl border text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  {otpError && (
                    <div className="text-red-500 text-xs text-center flex items-center justify-center gap-1.5">
                      <AlertCircle size={13} /> {otpError}
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-3">
                    <button
                      onClick={() => setActiveForm(otpFlow)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'}`}
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleVerifyOtp}
                      disabled={loadingOtp || otpCode.length < 6}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md"
                    >
                      {loadingOtp ? <Loader2 size={13} className="animate-spin" /> : 'Verificar código'}
                    </button>
                  </div>
                </div>
              )}

              {activeForm === 'scheduler' && (
                <div className="space-y-4">
                  <p className={`text-xs ${textSub} leading-relaxed`}>
                    Selecione uma data para a sua entrevista e atendimento na igreja.
                  </p>

                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 text-xs">
                    {getAvailableDates().map((d) => {
                      const dateStr = d.toISOString().slice(0, 10);
                      const displayStr = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
                      const active = scheduledDate === dateStr;
                      return (
                        <button
                          key={dateStr}
                          onClick={() => setScheduledDate(dateStr)}
                          className="flex items-center gap-2 p-2.5 rounded-xl border font-semibold text-left transition-colors"
                          style={active
                            ? { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: '#10b981', color: '#10b981' }
                            : { backgroundColor: 'transparent', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#cbd5e1' : '#475569' }
                          }
                        >
                          <Calendar size={14} className={active ? 'text-emerald-500' : 'text-slate-400'} />
                          {displayStr.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2.5 pt-3">
                    <button
                      onClick={() => setActiveForm('otp')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'}`}
                    >
                      Voltar
                    </button>
                    <button
                      onClick={() => handleConfirmSchedule(scheduledDate)}
                      disabled={loadingOtp || !scheduledDate}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md"
                    >
                      {loadingOtp ? <Loader2 size={13} className="animate-spin" /> : 'Agendar Entrevista'}
                    </button>
                  </div>
                </div>
              )}

              {activeForm === 'success' && (
                <div className="flex flex-col items-center text-center py-6 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Check size={28} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-base mb-1.5 ${textPrimary}`}>Solicitação Confirmada!</h3>
                    <p className={`text-xs leading-relaxed max-w-sm ${textSub}`}>
                      {otpFlow === 'pastoral' ? (
                        'Recebemos sua solicitação de atendimento pastoral com sucesso. Em breve um pastor entrará em contato.'
                      ) : (
                        `Sua entrevista está agendada para: ${successInfo.date}.\n\nVocê está atualmente na posição #${successInfo.position} da fila de agendamentos.`
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowFabModal(false)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md"
                  >
                    Fechar
                  </button>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {showPenielModal && (
        <PenielRegistrationModal
          isOpen={showPenielModal}
          onClose={() => setShowPenielModal(false)}
        />
      )}
    </div>
  );
}

