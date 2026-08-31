import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { User, Play, Radio, Camera, Users, MapPin, Sun, Moon, MessageSquare, Info, HeartHandshake, Calendar, Check, AlertCircle, Sparkles, BookOpen, X, Loader2, LogIn, DollarSign, Briefcase, Laptop, Heart, Baby, Clock, Home as HomeIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MembroLogin } from '../membro/MembroLogin';
import { MembroProvider } from '../membro/MembroProvider';
import { PenielRegistrationModal } from './PenielRegistrationModal';
import { ContabilidadeModal } from './ContabilidadeModal';
import { apiBase } from '../../lib/apiBase';
import { toast } from 'sonner';
import { ScrollHint } from './ScrollHint';
import { InstallAppCard } from '../pwa/InstallAppCard';
import {
  EMPTY_FICHA, faltandoNaFicha, MembershipFullFormFields,
  type FichaCompleta, type IgrejaPublica,
} from './MembershipFullFormFields';
import { cpfValido, digitos, mascaraTelefone } from './fichaHelpers';
import { resolveHomeIcon } from './homeIcons';
import {
  DEFAULT_HOME_PAYLOAD, mapsUrlFor, mergeHomePayload, resolveCardUrl,
  type HomeCard, type HomeConfigPayload, type HomeSede,
} from '../../lib/homeConfig';

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
const BIBLICAL_SYMBOL_COUNT = 15;

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

function BiblicalFloatingElements({ isDark, colors }: { isDark: boolean; colors?: string[] }) {
  const [items, setItems] = useState<FloatingItem[]>([]);
  // A paleta vem da configuração da igreja; sem ela, a original.
  const palette = colors && colors.length ? colors : BIBLICAL_COLORS;
  const paletteKey = palette.join(',');

  useEffect(() => {
    const generated: FloatingItem[] = [];
    // Mais elementos para uma amostragem maior alternando na tela
    for (let i = 0; i < 24; i++) {
      generated.push({
        id: i,
        type: i % BIBLICAL_SYMBOL_COUNT,
        left: Math.random() * 85 + 5,
        top: Math.random() * 80 + 10,
        size: Math.floor(Math.random() * 30) + 38,
        duration: Math.floor(Math.random() * 12) + 16,
        delay: Math.floor(Math.random() * 8),
        // Ciclo de aparecer/sumir (fade) defasado por elemento
        fadeDuration: Math.floor(Math.random() * 6) + 7,
        fadeDelay: Math.floor(Math.random() * 10),
        color: palette[i % palette.length],
        // Opacidade de pico (mais visível que antes, mas sem competir com o texto)
        peak: (isDark ? 0.16 : 0.12) + Math.random() * 0.1,
      });
    }
    setItems(generated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, paletteKey]);

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
      case 12: // Lion (Leão de Judá)
        return <path d="M28 62 C22 62 16 56 18 48 C14 44 16 36 24 36 C24 28 32 22 40 24 C42 18 50 16 56 20 C62 18 68 22 66 30 C74 28 80 34 76 42 C82 44 82 52 74 54 C76 60 70 65 62 62 C58 66 46 66 42 62 Z M30 62 L28 76 M44 62 L44 76 M56 60 L58 76 M40 40 L42 43 M52 40 L54 43 M44 50 Q48 53 52 50 M76 42 C86 40 92 48 88 56 C85 62 78 60 76 54" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 13: // Candelabro (Menorá)
        return <path d="M50 85 L50 28 M50 60 L38 60 L38 28 M50 60 L62 60 L62 28 M50 68 L26 68 L26 28 M50 68 L74 68 L74 28 M50 76 L14 76 L14 28 M50 76 L86 76 L86 28 M35 85 L65 85 M40 91 L60 91 M50 28 C47 22 47 18 50 14 C53 18 53 22 50 28 M38 28 C36 24 36 22 38 19 C40 22 40 24 38 28 M62 28 C60 24 60 22 62 19 C64 22 64 24 62 28 M26 28 C24 24 24 22 26 19 C28 22 28 24 26 28 M74 28 C72 24 72 22 74 19 C76 22 76 24 74 28 M14 28 C12 24 12 22 14 19 C16 22 16 24 14 28 M86 28 C84 24 84 22 86 19 C88 22 88 24 86 28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 14: // Templo de Salomão
        return <path d="M50 15 L15 40 L85 40 Z M15 40 L85 40 M20 40 L20 71 M30 40 L30 71 M40 40 L40 71 M60 40 L60 71 M70 40 L70 71 M80 40 L80 71 M25 71 L75 71 M20 78 L80 78 M15 85 L85 85 M45 71 L45 60 L55 60 L55 71" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
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
  /**
   * Tema salvo (compartilhado com a página pública do Peniel), lido já na
   * criação do estado. Ler num efeito não funcionava: o efeito que PERSISTE
   * rodava antes de o estado lido ser aplicado e regravava `isDark: true` por
   * cima — na prática o escuro voltava a cada recarga, por mais que a pessoa
   * escolhesse o claro. O SPA é client-only (`ssr: false`), então ler o
   * localStorage aqui não gera divergência de hidratação.
   */
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('mrm_theme_settings');
      return saved ? JSON.parse(saved).isDark !== false : true;
    } catch {
      return true;
    }
  });
  /**
   * Personalização da igreja (logo, textos, cores, cartões e serviços).
   * Começa no padrão — que é exatamente o conteúdo de hoje — e é substituída
   * quando a API responde: a home nunca aparece vazia nem pisca.
   */
  const [home, setHome] = useState<HomeConfigPayload>(DEFAULT_HOME_PAYLOAD);

  /**
   * Se a pessoa já escolheu claro/escuro alguma vez. Precisa ser lido ANTES do
   * efeito que persiste o tema rodar — depois dele a chave sempre existe e o
   * tema padrão da igreja nunca seria aplicado.
   */
  const [tinhaPreferenciaDeTema] = useState(() => {
    if (typeof window === 'undefined') return true;
    try { return !!localStorage.getItem('mrm_theme_settings'); } catch { return true; }
  });

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // `no-store` também aqui: o cache do próprio navegador guardava a
        // resposta anterior e a home continuava mostrando a configuração
        // antiga mesmo depois de a igreja salvar.
        const res = await fetch(`${apiBase}/public/home-config`, { cache: 'no-store' });
        if (!res.ok) return;
        const payload = mergeHomePayload(await res.json());
        if (!vivo) return;
        setHome(payload);
        // Tema inicial escolhido pela igreja só vale para quem ainda não
        // clicou no sol/lua — a preferência da pessoa vence sempre.
        if (!tinhaPreferenciaDeTema) setIsDark(payload.config.defaultDark);
      } catch { /* sem configuração, segue com o padrão */ }
    })();
    return () => { vivo = false; };
  }, [tinhaPreferenciaDeTema]);

  const cfg = home.config;
  const sede = home.sede;

  const [showMembroLogin, setShowMembroLogin] = useState(false);
  const [showPenielModal, setShowPenielModal] = useState(false);
  const [showVerseModal, setShowVerseModal] = useState(false);
  // Círculo que se expande a partir do ponto clicado até cobrir a tela,
  // antes de ir para /gf. A navegação só dispara ao fim da animação.
  const [gfSliding, setGfSliding] = useState(false);
  const [gfOrigin, setGfOrigin] = useState({ x: 0, y: 0 });
  const [showContabilidade, setShowContabilidade] = useState(false);
  // 7 toques seguidos no gatilho invisivel do cabecalho abrem a contabilidade.
  // Se demorar mais de 2 s entre um toque e outro, a contagem recomeca.
  const contabilidadeToques = useRef(0);
  const contabilidadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function registrarToqueContabilidade() {
    if (contabilidadeTimer.current) clearTimeout(contabilidadeTimer.current);
    contabilidadeToques.current += 1;

    if (contabilidadeToques.current >= 7) {
      contabilidadeToques.current = 0;
      setShowContabilidade(true);
      return;
    }

    contabilidadeTimer.current = setTimeout(() => { contabilidadeToques.current = 0; }, 2000);
  }
  const [showFabModal, setShowFabModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<'options' | 'pastoral' | 'membership' | 'otp' | 'scheduler' | 'success' | 'duplicate'>('options');
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
  // pedido igual já vivo no pipeline — vira aviso, não erro (o dado é válido,
  // só não faz sentido abrir um segundo card para o mesmo assunto)
  const [duplicateInfo, setDuplicateInfo] = useState<{ message: string; stage: string } | null>(null);
  // campo escolhido pela pessoa — decide para qual igreja SEDE o pedido vai
  const [campos, setCampos] = useState<Array<{ id: string; name: string }>>([]);
  const [campoId, setCampoId] = useState('');

  // ── "Quero ser Membro": dados básicos (agenda a entrevista e a ficha vem
  //    depois pelo WhatsApp) ou ficha completa preenchida aqui mesmo.
  const [membershipTab, setMembershipTab] = useState<'basico' | 'ficha'>('basico');
  const [ficha, setFicha] = useState<FichaCompleta>(EMPTY_FICHA);
  const [igrejas, setIgrejas] = useState<IgrejaPublica[]>([]);
  const [carregandoIgrejas, setCarregandoIgrejas] = useState(false);
  // igreja escolhida na ficha completa — é para ela que a adesão vai, sem
  // depender do campo (a lista pública traz todas as igrejas ativas)
  const [churchId, setChurchId] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const fotoPreviewRef = useRef('');

  const fichaAtiva = otpFlow === 'membership' && membershipTab === 'ficha';

  const setFichaCampo = <K extends keyof FichaCompleta>(k: K, v: FichaCompleta[K]) =>
    setFicha(f => ({ ...f, [k]: v }));
  const patchFicha = (p: Partial<FichaCompleta>) => setFicha(f => ({ ...f, ...p }));

  const escolherFoto = (file: File) => {
    if (fotoPreviewRef.current) URL.revokeObjectURL(fotoPreviewRef.current);
    const url = URL.createObjectURL(file);
    fotoPreviewRef.current = url;
    setFotoFile(file);
    setFotoPreview(url);
  };

  const removerFoto = () => {
    if (fotoPreviewRef.current) URL.revokeObjectURL(fotoPreviewRef.current);
    fotoPreviewRef.current = '';
    setFotoFile(null);
    setFotoPreview('');
  };

  // libera a URL local do preview ao sair da tela
  useEffect(() => () => { if (fotoPreviewRef.current) URL.revokeObjectURL(fotoPreviewRef.current); }, []);

  // a lista de igrejas só é buscada quando a aba da ficha é aberta
  useEffect(() => {
    if (activeForm !== 'membership' || membershipTab !== 'ficha' || igrejas.length) return;
    (async () => {
      setCarregandoIgrejas(true);
      try {
        const res = await fetch(`${apiBase}/public/churches`);
        if (!res.ok) return;
        const data = await res.json();
        setIgrejas(Array.isArray(data) ? data : []);
      } catch { /* sem lista, a pessoa usa a aba de dados básicos */ }
      finally { setCarregandoIgrejas(false); }
    })();
  }, [activeForm, membershipTab, igrejas.length]);

  useEffect(() => {
    // os dois formulários mostram o select de campo — carregar só no de
    // membresia deixava o do atendimento pastoral com a lista vazia
    if ((activeForm !== 'membership' && activeForm !== 'pastoral') || campos.length) return;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/campos/public`);
        if (!res.ok) return;
        const data = await res.json();
        setCampos(Array.isArray(data) ? data : []);
      } catch { /* sem lista, o pedido cai na sede padrão */ }
    })();
  }, [activeForm, campos.length]);

  const navigate = useNavigate();

  // Persiste o tema escolhido para que outras páginas públicas (Peniel) o sigam
  useEffect(() => {
    try {
      localStorage.setItem("mrm_theme_settings", JSON.stringify({ isDark }));
    } catch { /* ignore */ }
  }, [isDark]);

  /**
   * A classe `.dark` do <html> é do app da secretaria (localStorage
   * `mrm_theme`), e ficava ligada aqui mesmo com a home no claro. Como o
   * globals.css tem regras `.dark .text-slate-800 { color: #f8fafc !important }`
   * — mas nenhuma equivalente para `bg-white/90` —, os rótulos do menu de
   * serviços viravam texto branco sobre pílula branca no celular.
   *
   * A home passa a mandar na classe enquanto está na tela, e devolve o estado
   * anterior ao sair, como as outras páginas públicas já fazem.
   */
  useEffect(() => {
    const root = document.documentElement;
    const anterior = root.classList.contains('dark');
    root.classList.toggle('dark', isDark);
    return () => { root.classList.toggle('dark', anterior); };
  }, [isDark]);

  const bg        = isDark ? cfg.bgDark : cfg.bgLight;
  const accent    = cfg.accentColor;
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
    if (fichaAtiva) {
      // Na ficha completa a igreja substitui o campo: a pessoa escolhe direto
      // onde quer se membrar, e o pedido vai para lá.
      if (!phone.trim()) {
        setFormError('Informe o WhatsApp — é por ele que confirmamos seu pedido.');
        return;
      }
      const faltando = faltandoNaFicha(ficha, churchId);
      if (faltando.length) {
        setFormError(`Preencha: ${faltando.join(', ')}.`);
        return;
      }
      if (!cpfValido(ficha.cpf)) {
        setFormError('CPF inválido. Confira os números — é com ele que você acessa o Portal do Membro.');
        return;
      }
    } else {
      if (!visitorName.trim() || !phone.trim()) {
        setFormError('Por favor, preencha o seu nome e telefone.');
        return;
      }
      // sem o campo o pedido cairia na sede padrão, provavelmente a errada.
      // Só exige quando a lista carregou — se `/campos/public` falhar, é melhor
      // aceitar o pedido na sede padrão do que travar a pessoa na tela.
      if (campos.length > 0 && !campoId) {
        setFormError('Escolha o campo para sabermos qual igreja vai te atender.');
        return;
      }
    }
    // DDD + número: o código do WhatsApp é enviado para este número, e um
    // telefone incompleto só voltaria como erro do servidor depois da espera
    if (digitos(phone).length < 10) {
      setFormError('WhatsApp incompleto — informe DDD e número, ex.: (19) 99999-9999.');
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
            campoId: campoId || undefined,
            otp_token: otpToken,
            code: otpCode,
          }),
        });
        const data = await res.json();
        if (res.status === 409 && data.duplicate) {
          setDuplicateInfo({ message: data.error, stage: data.stage });
          setActiveForm('duplicate');
          return;
        }
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
      // O WhatsApp verificado é sempre o telefone do pedido; na ficha ele também
      // preenche o campo de contato quando a pessoa não informou outro.
      const formData = fichaAtiva ? { ...ficha, phone: ficha.phone || phone } : undefined;
      const nomeCompleto = fichaAtiva
        ? `${ficha.firstName} ${ficha.lastName}`.trim()
        : visitorName;

      const res = await fetch(`${apiBase}/public/pastoral/create-membership-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nomeCompleto,
          whatsapp: phone,
          isMarried: fichaAtiva ? ficha.maritalStatus === 'married' : isMarried,
          pastChurches: fichaAtiva ? ficha.pastChurch : pastChurchesStr,
          afroBackground: fichaAtiva ? false : afroBackgrounds.length > 0,
          scheduledDate: dateStr,
          campoId: fichaAtiva ? undefined : campoId || undefined,
          churchId: fichaAtiva ? churchId : undefined,
          formData,
          otp_token: otpToken,
          code: otpCode,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicate) {
        setDuplicateInfo({ message: data.error, stage: data.stage });
        setActiveForm('duplicate');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Erro ao agendar');

      // A foto sobe depois do pedido criado: é o token da ficha que autoriza o
      // upload. Falha aqui não invalida a adesão — a pessoa reenvia a foto pelo
      // link da ficha que recebe no WhatsApp.
      if (fichaAtiva && fotoFile && data.formToken) {
        try {
          const fd = new FormData();
          fd.append('file', fotoFile);
          const up = await fetch(`${apiBase}/public/membership-form/${data.formToken}/photo`, {
            method: 'POST',
            body: fd,
          });
          const dataUp = await up.json().catch(() => ({}));
          if (up.ok && dataUp.url) {
            await fetch(`${apiBase}/public/membership-form/${data.formToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ formData: { ...formData, photoUrl: dataUp.url }, documents: [] }),
            });
          } else {
            toast.error('Não conseguimos enviar sua foto — use o link da ficha no WhatsApp.');
          }
        } catch {
          toast.error('Não conseguimos enviar sua foto — use o link da ficha no WhatsApp.');
        }
      }

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

  // ── Cartões da home ───────────────────────────────────────────────────────
  // Cada ícone da tela é uma linha de `home_cards`. O JSX abaixo é o mesmo de
  // antes (mesmas classes, mesmos tamanhos); o que mudou é de onde vêm título,
  // ícone, cor e destino.

  /** "linha 1\nlinha 2" → linha 1<br />linha 2 */
  const comQuebras = (texto: string) =>
    texto.split('\n').map((linha, i) => (
      <span key={i}>{i > 0 && <br />}{linha}</span>
    ));

  /** Programação da sede agrupada por dia, na ordem cadastrada. */
  const agendaPorDia = (dados: HomeSede) => {
    const dias: { dia: string; itens: string[] }[] = [];
    for (const linha of dados.schedules) {
      const existente = dias.find(d => d.dia === linha.dayOfWeek);
      const item = [linha.time, linha.name].filter(Boolean).join(' ');
      if (existente) existente.itens.push(item);
      else dias.push({ dia: linha.dayOfWeek, itens: [item] });
    }
    return dias;
  };

  const corpoDoCartao = (card: HomeCard) => {
    if (card.action === 'maps') {
      return (
        <p className={`text-xs leading-relaxed ${textSub}`}>
          {sede.address}
          {sede.phone && <><br />Telefone/WhatsApp: {sede.phone}</>}
        </p>
      );
    }

    if (card.action === 'agenda') {
      return (
        <div className={`text-xs leading-relaxed space-y-0.5 ${textSub}`}>
          {agendaPorDia(sede).map(({ dia, itens }) => (
            <p key={dia}>
              <strong className={textPrimary}>{dia}:</strong> {itens.join(' · ')}
            </p>
          ))}
        </div>
      );
    }

    if (!card.subtitle) return null;

    return (
      <p className={`text-xs leading-relaxed ${card.liveDot ? 'flex items-center gap-2' : ''} ${textSub}`}>
        {comQuebras(card.subtitle)}
        {card.liveDot && <span className="w-2.5 h-2.5 rounded-full bg-[#00b894] animate-pulse" />}
      </p>
    );
  };

  const renderCard = (card: HomeCard) => {
    // O convite de instalar o app tem lógica própria (some se já instalado ou
    // se o navegador não sabe instalar) e é padrão da plataforma.
    if (card.action === 'pwa') return <InstallAppCard key={card.key} isDark={isDark} />;

    const Icone = resolveHomeIcon(card.icon);
    const destacado = !!card.iconColor;

    const anel = (
      <div
        className={`home-card-ring flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
          destacado ? 'border-2' : `border ${border}`
        } ${card.pulse ? 'animate-pulse' : ''}`}
        style={destacado ? {
          borderColor: card.iconColor as string,
          background: `${card.iconColor}1f`,
          ...(card.pulse ? { boxShadow: `0 0 16px ${card.iconColor}73` } : {}),
        } : undefined}
      >
        <Icone
          className={`home-card-icon w-6 h-6 transition-colors ${destacado ? '' : iconColor}`}
          style={destacado ? { color: card.iconColor as string } : undefined}
        />
      </div>
    );

    const conteudo = (
      <>
        {anel}
        <div className="flex flex-col justify-center min-h-[3.5rem]">
          <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>{card.title}</h3>
          {corpoDoCartao(card)}
        </div>
      </>
    );

    const classe = `home-card flex items-start gap-4 group hover:opacity-80 transition-opacity text-left${
      card.fullWidth ? ' lg:col-span-2' : ''
    }`;
    // Cor de hover vira variável CSS: classe Tailwind dinâmica não existe em
    // build time, e a cor vem do banco.
    const estilo = card.hoverColor ? ({ ['--hv' as any]: card.hoverColor }) : undefined;

    if (card.action === 'link' || card.action === 'maps') {
      const href = card.action === 'maps' ? mapsUrlFor(sede) : resolveCardUrl(card, sede);
      // Link sem destino (rede social ainda não cadastrada em Informações da
      // Igreja) não vira um <a> quebrado — vira um bloco sem clique.
      if (!href) return <div key={card.key} className={classe} style={estilo}>{conteudo}</div>;
      return (
        <a key={card.key} href={href} target="_blank" rel="noopener noreferrer" className={classe} style={estilo}>
          {conteudo}
        </a>
      );
    }

    if (card.action === 'agenda') {
      return <div key={card.key} className={classe} style={estilo}>{conteudo}</div>;
    }

    const aoClicar = (e: React.MouseEvent) => {
      if (card.action === 'membro') return setShowMembroLogin(true);
      if (card.action === 'peniel') return setShowPenielModal(true);
      if (card.action === 'verse') return setShowVerseModal(true);
      if (card.action === 'gf') {
        // A navegação só acontece quando o círculo termina de cobrir a tela.
        setGfOrigin({ x: e.clientX, y: e.clientY });
        setGfSliding(true);
      }
    };

    return (
      <button key={card.key} onClick={aoClicar} className={classe} style={estilo}>
        {conteudo}
      </button>
    );
  };

  // Opções do atendimento da secretaria, filtradas e renomeadas pela igreja.
  const fabOptions = FAB_OPTIONS
    .filter(opt => !cfg.services.hidden.includes(opt.id))
    .map(opt => ({ ...opt, label: cfg.services.labels[opt.id] || opt.label }));

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
        /* Cor de hover de cada cartão vem do banco: classe Tailwind dinâmica
           não existe em build time, então a cor viaja numa variável CSS. */
        .home-card:hover .home-card-ring{border-color:var(--hv,inherit)}
        .home-card:hover .home-card-icon{color:var(--hv,inherit)}
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
        /* Seta de "role para ver mais" (mobile) */
        @keyframes scroll-hint-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes scroll-hint-bounce { 0%, 100% { transform: none; } }
        }
      `}</style>

      {isDark && cfg.showSpotlights && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="spotlight-left"/><div className="spotlight-right"/>
          <div className="comet comet-1"/><div className="comet comet-2"/><div className="comet comet-3"/>
        </div>
      )}

      {/* Elegant Biblical Floating Elements Background */}
      {cfg.showSymbols && <BiblicalFloatingElements isDark={isDark} colors={cfg.symbolColors} />}

      {cfg.watermarkUrl && (
        <img src={cfg.watermarkUrl} alt=""
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-[80vw] md:w-[50vw] lg:w-[42rem] aspect-square object-cover rounded-full z-0"
          style={{
            // O tema claro sempre foi um pouco mais discreto que o escuro.
            opacity: isDark ? cfg.watermarkOpacity : cfg.watermarkOpacity * 0.8,
            mixBlendMode: isDark ? 'screen' : 'multiply',
          }} />
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-6 md:px-12 relative z-10">
        {/* Sem logo cadastrada, um círculo neutro: melhor um espaço vazio do
            que a marca de outra igreja (ou o ícone de imagem quebrada). */}
        {cfg.logoUrl ? (
          <img
            src={cfg.logoUrl}
            alt={cfg.siteTitle || 'Logo da igreja'}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-full object-cover opacity-95 hover:opacity-100 transition-opacity ring-1 ${isDark ? 'ring-white/10' : 'ring-black/10'}`}
          />
        ) : (
          <div
            aria-hidden="true"
            className={`w-12 h-12 md:w-14 md:h-14 rounded-full ring-1 ${isDark ? 'ring-white/10 bg-white/5' : 'ring-black/10 bg-black/5'}`}
          />
        )}
        <div className="flex items-center gap-3">
          {/* Contabilidade — gatilho invisivel a esquerda do icone de tema:
              7 toques abrem o modal do contador. Mesmo formato do icone de
              login, porem sem nenhuma pista visual. */}
          <button
            onClick={registrarToqueContabilidade}
            aria-hidden="true"
            tabIndex={-1}
            className="w-10 h-10 rounded-full opacity-0 cursor-default select-none"
          />
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
          {/* Texto ainda não cadastrado vira um traço — a home nasce em branco
              e espera o cadastro, em vez de exibir o texto de outra igreja. */}
          {cfg.heroEyebrow && (
            <p className={`font-medium mb-2 text-sm tracking-wide ${textMuted}`}>{cfg.heroEyebrow}</p>
          )}
          <h1 className={`text-6xl md:text-7xl lg:text-[5.5rem] font-medium mb-8 tracking-tight ${textPrimary}`}>
            {cfg.heroTitle || cfg.siteTitle || '—'}
          </h1>
          {cfg.heroText && (
            <p className={`leading-relaxed mb-6 text-sm md:text-base font-light ${textSub}`}>
              {cfg.heroText}
            </p>
          )}
          {cfg.showVerse && (
            <div className="flex items-center gap-2">
              <p className={`text-xs tracking-wide ${textMuted}`}>{cfg.verseRef}</p>
              <button
                onClick={() => setShowVerseModal(true)}
                className="text-xs font-semibold tracking-wide underline decoration-dotted underline-offset-4 hover:opacity-70 transition-opacity"
                style={{ color: accent }}
              >
                {cfg.verseLabel}
              </button>
            </div>
          )}
        </div>

        {/* Os ícones vêm de `home_cards`: a igreja reordena, oculta, renomeia e
            troca o destino de cada um em Sistema → Home Pública. */}
        <div className="w-full md:w-1/2 max-w-xl grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-7">
          {home.cards.filter(card => card.visible).map(renderCard)}
        </div>
      </main>

      {/* Indicador de "tem mais abaixo" — mobile, onde a barra de rolagem
          está escondida pelo CSS global desta página */}
      <ScrollHint hidden={fabOpen || showFabModal || showMembroLogin || showPenielModal} />

      {/* Botão flutuante de atendimento da secretaria. A igreja pode desligá-lo
          inteiro em Sistema → Home Pública. */}
      {cfg.services.enabled && (
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
                {fabOptions.map((opt, index) => {
                  const Icon = opt.icon;
                  return (
                    <motion.div
                      key={opt.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        transition: { delay: (fabOptions.length - 1 - index) * 0.02 }
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
                        setMembershipTab('basico');
                        setFicha(EMPTY_FICHA);
                        setChurchId('');
                        removerFoto();

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
      )}

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
              // a ficha completa tem muito mais campo: ganha largura e rolagem
              className={`relative w-full rounded-2xl border p-6 shadow-2xl z-10 transition-all duration-300 ${modalBg} ${
                activeForm === 'membership' && membershipTab === 'ficha'
                  ? 'max-w-xl max-h-[90vh] overflow-y-auto'
                  : 'max-w-md overflow-hidden'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-emerald-500" />
                  <h2 className={`font-bold text-lg ${textPrimary}`}>
                    {/* Sem título cadastrado, o rótulo genérico do módulo —
                        nunca o nome de outra igreja. */}
                    {activeForm === 'options' && (cfg.services.title || 'Atendimento')}
                    {activeForm === 'pastoral' && 'Solicitar Atendimento'}
                    {activeForm === 'membership' && 'Quero ser Membro'}
                    {activeForm === 'otp' && 'Verificação de WhatsApp'}
                    {activeForm === 'scheduler' && 'Agende seu Atendimento'}
                    {activeForm === 'success' && 'Solicitação Enviada!'}
                    {activeForm === 'duplicate' && 'Pedido já em andamento'}
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
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Campo / Região *
                    </label>
                    <select
                      value={campoId}
                      onChange={(e) => setCampoId(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    >
                      <option value="">Selecione o campo mais próximo</option>
                      {campos.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Seu pedido vai para a igreja sede desse campo.
                    </p>
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
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(mascaraTelefone(e.target.value))}
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
                  {/* Duas portas para o mesmo pedido: só o básico (a ficha vem
                      depois pelo WhatsApp) ou a ficha inteira agora. */}
                  <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    {([
                      { id: 'basico', titulo: 'Dados básicos', sub: 'rápido, ficha depois' },
                      { id: 'ficha', titulo: 'Ficha completa', sub: 'já envio tudo agora' },
                    ] as const).map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setMembershipTab(t.id); setFormError(''); }}
                        className={`rounded-lg py-2 px-2 text-center transition-colors ${
                          membershipTab === t.id
                            ? 'bg-emerald-600 text-white shadow'
                            : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-white'
                        }`}
                      >
                        <span className="block text-xs font-bold">{t.titulo}</span>
                        <span className={`block text-[10px] ${membershipTab === t.id ? 'text-emerald-50' : 'text-slate-400'}`}>
                          {t.sub}
                        </span>
                      </button>
                    ))}
                  </div>

                  {membershipTab === 'ficha' ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                          WhatsApp *
                          <div className="group relative cursor-pointer text-slate-400 hover:text-emerald-500">
                            <Info size={13} />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-300 z-50 leading-relaxed shadow-lg">
                              🔐 Enviamos um código para confirmar que o número é seu.
                            </span>
                          </div>
                        </label>
                        <input
                          type="tel"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => setPhone(mascaraTelefone(e.target.value))}
                          placeholder="(19) 99999-9999"
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                        />
                      </div>

                      <MembershipFullFormFields
                        form={ficha}
                        set={setFichaCampo}
                        patch={patchFicha}
                        isDark={isDark}
                        igrejas={igrejas}
                        carregandoIgrejas={carregandoIgrejas}
                        churchId={churchId}
                        onChurchId={setChurchId}
                        fotoPreview={fotoPreview}
                        onFoto={escolherFoto}
                        onRemoverFoto={removerFoto}
                      />

                      {formError && (
                        <div className="text-red-500 text-xs flex items-start gap-1.5">
                          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> {formError}
                        </div>
                      )}

                      <div className="flex gap-2.5 pt-1">
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
                    </>
                  ) : (
                  <>
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
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(mascaraTelefone(e.target.value))}
                      placeholder="(19) 99999-9999"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    />
                  </div>

                  {/* Campo obrigatório: sem ele handleSendOtp bloqueia o envio e
                      a pessoa fica sem saber onde escolher. */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Campo / Região *
                    </label>
                    <select
                      value={campoId}
                      onChange={(e) => setCampoId(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'}`}
                    >
                      <option value="">Selecione o campo mais próximo</option>
                      {campos.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Sua adesão vai para a igreja sede desse campo.
                    </p>
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
                  </>
                  )}
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

              {activeForm === 'duplicate' && duplicateInfo && (
                <div className="flex flex-col items-center text-center py-6 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Clock size={28} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-base mb-1.5 ${textPrimary}`}>
                      Seu pedido já está conosco
                    </h3>
                    <p className={`text-xs leading-relaxed max-w-sm ${textSub}`}>
                      {duplicateInfo.message}
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-semibold">
                      Fase atual: {duplicateInfo.stage}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowFabModal(false)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md"
                  >
                    Entendi, fechar
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

      <ContabilidadeModal open={showContabilidade} onClose={() => setShowContabilidade(false)} />

      {/* Transição para /gf — um círculo nasce no ponto clicado e se expande
          até cobrir a tela ("bola abrindo"). A página de Grupos Familiares
          também é branca, então a navegação no fim da animação não gera
          nenhum "salto" de cor. Raio final em px (não %) para garantir que
          cobre até o canto mais distante do clique, em qualquer tamanho de tela. */}
      <AnimatePresence>
        {gfSliding && (() => {
          const raioFinal = Math.hypot(
            Math.max(gfOrigin.x, window.innerWidth - gfOrigin.x),
            Math.max(gfOrigin.y, window.innerHeight - gfOrigin.y),
          );
          return (
            <motion.div
              key="gf-slide"
              initial={{ clipPath: `circle(0px at ${gfOrigin.x}px ${gfOrigin.y}px)` }}
              animate={{ clipPath: `circle(${raioFinal}px at ${gfOrigin.x}px ${gfOrigin.y}px)` }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => navigate('/gf')}
              className="fixed inset-0 z-[100] bg-white flex items-center justify-center"
            >
              <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center animate-pulse"
                style={{ borderColor: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}>
                <HomeIcon className="w-6 h-6" style={{ color: '#f59e0b' }} />
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Modal do versículo — abre ao clicar em "Leia" ao lado de João 3:16 */}
      <AnimatePresence>
        {showVerseModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowVerseModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-md rounded-2xl border p-7 shadow-2xl z-10 ${modalBg}`}
            >
              <button
                onClick={() => setShowVerseModal(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:bg-slate-500/10 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${accent}1f` }}>
                  <BookOpen className="w-5 h-5" style={{ color: accent }} />
                </div>
                <span className={`text-sm font-bold tracking-wide ${textPrimary}`}>{cfg.verseRef}</span>
              </div>

              <p className={`text-lg md:text-xl leading-relaxed font-light italic ${textPrimary}`}>
                &ldquo;{cfg.verseText}&rdquo;
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

