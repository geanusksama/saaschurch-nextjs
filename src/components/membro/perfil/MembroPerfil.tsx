"use client";

/**
 * Perfil do membro — Portal "Sou Membro".
 *
 * TEMA CLARO SEMPRE. Mesmo motivo do GfPublicList/GfResumoPublic: os cards e o
 * texto slate só funcionam sobre fundo claro, e o globals.css reescreve
 * `bg-white`/`text-slate-*` enquanto o <html> tiver a classe `dark`. Esta rota
 * tira a classe enquanto está montada e devolve ao sair.
 *
 * A tela cresce com quem a pessoa é, sem card vazio:
 *  - sempre: foto ocupando metade da tela, título, ROL ao lado do nome e os
 *    ícones da vida na igreja;
 *  - se lidera ou participa de um GF: o bloco do Grupo Familiar;
 *  - se tem vida eclesiástica: funções, ministérios e batismo.
 * Isso vem de /api/membro/perfil (join no servidor) — a sessão do localStorage
 * sozinha só tem a ficha básica.
 *
 * Os ícones do meio (filhos, presenças, eventos) abrem modais alimentados por
 * /api/membro/atividades, buscado só no primeiro toque. Este bloco é o começo
 * da página única que vai substituir as abas do menu.
 *
 * O cadastro facial (Face ID) e as curtidas são os mesmos de antes: aqui mudou
 * o layout, não o funcionamento deles.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Heart, ScanFace, MoreHorizontal, Users, MapPin, Star, X, LogOut,
  Award, Sparkles, Droplets, ExternalLink, Phone, Loader2, Baby, CalendarCheck,
  Ticket, ChevronRight, BookOpen, Church, PlayCircle, Flame, Mic,
  Calendar, ShoppingCart, Sunrise, HeartHandshake, Send, Clock, Hammer, HandCoins, Copy, Check,
  GraduationCap, Library, Gamepad2,
} from 'lucide-react';
import { useMembroSession } from '../MembroProvider';
import { MEMBRO } from '../theme';
import { buildMapEmbedUrl, buildMapsLink } from '../../../lib/geo';

const { ACCENT, BG, CARD, BORDER, TEXT1, TEXT2, SHADOW } = MEMBRO;

// ── Tipos do /api/membro/perfil ───────────────────────────────────
interface PerfilLeader { id: string; name: string; phone: string | null; photoUrl: string | null; principal: boolean }
interface PerfilGf {
  id: string; name: string; description: string | null; cellType: string | null;
  meetingDay: string | null; meetingTime: string | null; color: string | null; photo: string | null;
  addressStreet: string | null; addressNumber: string | null; addressComplement: string | null;
  addressNeighborhood: string | null; addressCity: string | null; addressState: string | null;
  addressZipcode: string | null; latitude: number | null; longitude: number | null;
  leaders: PerfilLeader[]; memberCount: number; vinculo: 'lider' | 'participante'; joinedAt: string | null;
}
interface PerfilFuncao { id: string; name: string; abbreviation: string | null; department: string | null; startDate: string | null; isCampoWide: boolean }
interface PerfilMinisterio { id: string; name: string; role: string | null; color: string | null; joinedAt: string | null; isLeader: boolean }
interface PerfilBatismo { date: string | null; location: string | null; ministerName: string | null; certificateNumber: string | null }
/** Só os campos que esta tela usa — o resto do payload é ignorado aqui. */
interface PerfilMember {
  id: string; fullName: string; preferredName: string | null; photoUrl: string | null;
  ecclesiasticalTitle: string | null; membershipStatus: string | null; membershipDate: string | null;
  baptismDate: string | null; rol: number | null; email: string | null; phone: string | null;
  mobile: string | null; birthDate: string | null; gender: string | null; maritalStatus: string | null;
  nationality: string | null; fatherName: string | null; motherName: string | null; spouseName: string | null;
  occupation: string | null; addressStreet: string | null; addressNumber: string | null;
  addressNeighborhood: string | null; addressCity: string | null; addressState: string | null;
  churchName: string | null; campoName: string | null;
}
interface PerfilPayload {
  member: PerfilMember;
  gf: PerfilGf | null;
  funcoes: PerfilFuncao[];
  ministerios: PerfilMinisterio[];
  batismo: PerfilBatismo | null;
  temVidaEclesiastica: boolean;
}

// ── Tipos do /api/membro/atividades ───────────────────────────────
interface Familiar { id: string; tipo: string; parentesco: string; name: string; birthDate: string | null; idade: number | null; gender: string | null; photoUrl: string | null; ehMembro: boolean; rol: number | null }
interface Presenca { id: string; data: string; titulo: string; origem: 'evento' | 'leitor'; detalhe: string | null }
interface Inscricao { id: string; eventoId: string; titulo: string; inicio: string | null; local: string | null; status: string | null; pagamento: string | null; valor: number | null; compareceu: boolean; inscritoEm: string }
interface Doacao {
  churchName: string | null; pix: string | null; bank: string | null; cnpj: string | null;
  whatsapp: string | null; contact: string | null; email: string | null;
  endereco: string | null; site: string | null; instagram: string | null;
}
interface PaginaPresencas { itens: Presenca[]; total: number; pagina: number; porPagina: number; temMais: boolean }
interface AtividadesPayload {
  familia: Familiar[];
  inscricoes: Inscricao[];
  doacao: Doacao | null;
  totais: { familia: number; presencas: number; inscricoes: number };
}

type Aba = 'familia' | 'presencas' | 'inscricoes' | 'doacao';

// ── Helpers ────────────────────────────────────────────────────────
function safeDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(String(iso).includes('T') ? iso : iso + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}
function formatDate(iso?: string | null) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(iso?: string | null) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function toProper(s: string): string {
  const minor = ['da','de','do','das','dos','e','a','o'];
  return s.toLowerCase().replace(/\b\w+/g, (w, i) =>
    i === 0 || !minor.includes(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
  );
}
function statusColor(s?: string | null) {
  const v = (s || '').toLowerCase();
  if (v.includes('ativo') || v.includes('ativa')) return MEMBRO.OK;
  if (v.includes('inativo')) return MEMBRO.DANGER;
  return MEMBRO.WARN;
}
/**
 * Cor da tela conforme o sexo do cadastro: rosa para mulher, azul para homem.
 * Sem sexo preenchido (ou valor que não reconhecemos) fica o azul padrão — a
 * tela nunca "chuta" um gênero.
 */
const ROSA = '#db2777';
const ROSA_SOFT = '#fdf2f8';
function accentPorSexo(gender?: string | null): { accent: string; soft: string } {
  const v = (gender || '').trim().toUpperCase();
  if (v.startsWith('F')) return { accent: ROSA, soft: ROSA_SOFT };            // FEMININO / F
  if (v.startsWith('M')) return { accent: ACCENT, soft: MEMBRO.ACCENT_SOFT }; // MASCULINO / M
  return { accent: ACCENT, soft: MEMBRO.ACCENT_SOFT };
}

/** Hoje e o primeiro dia do mes corrente, em AAAA-MM-DD (fuso local). */
function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function primeiroDiaDoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function gfAddress(gf: PerfilGf): string {
  const rua = [gf.addressStreet, gf.addressNumber].filter(Boolean).join(', ');
  return [rua, gf.addressNeighborhood, gf.addressCity, gf.addressState].filter(Boolean).join(', ');
}
function waLink(phone: string, texto?: string) {
  const digits = phone.replace(/\D/g, '');
  const numero = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

// ── Peças de layout ────────────────────────────────────────────────
function Secao({ titulo, accent = ACCENT, children }: { titulo: string; accent?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
      <h3 className="px-4 pt-3.5 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: accent }}>{titulo}</h3>
      {children}
    </section>
  );
}

function Linha({ Icon, label, value, onClick, tint }: {
  Icon: React.ElementType; label: string; value: React.ReactNode;
  onClick?: () => void; tint?: string;
}) {
  const cor = tint || ACCENT;
  const inner = (
    <>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cor}14` }}>
        <Icon size={15} color={cor} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: TEXT2 }}>{label}</span>
        <span className="block text-[13px] font-semibold leading-snug" style={{ color: TEXT1 }}>{value}</span>
      </span>
      {onClick && <ExternalLink size={13} color={TEXT2} className="flex-shrink-0" />}
    </>
  );
  const cls = 'w-full flex items-center gap-3 px-4 py-3';
  if (onClick) return <button onClick={onClick} className={`${cls} active:bg-slate-50`}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

const Divisor = () => <div style={{ height: 1, background: BORDER, marginLeft: 16 }} />;

/** Bandeja que sobe de baixo — usada pelos modais dos ícones e pela ficha. */
function Bandeja({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(2,6,23,0.55)', backdropFilter: 'blur(8px)', colorScheme: 'light' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-sm px-5 pt-4 pb-10"
        style={{ background: CARD, borderRadius: '26px 26px 0 0', maxHeight: '82vh', overflowY: 'auto', scrollbarWidth: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-9 h-1 rounded-full" style={{ background: '#cbd5e1' }} />
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold" style={{ fontSize: 16, color: TEXT1 }}>{titulo}</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: BG, border: `1px solid ${BORDER}` }}
          >
            <X size={13} color={TEXT2} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="py-8 text-center text-[12px] leading-relaxed" style={{ color: TEXT2 }}>{texto}</p>;
}

// ═══════════════════════════════════════════════════════════════════
export default function MembroPerfil() {
  const { session, isLoading, logout } = useMembroSession();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [perfil, setPerfil] = useState<PerfilPayload | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);
  const [mapaAberto, setMapaAberto] = useState(false);
  const [aba, setAba] = useState<Aba | null>(null);
  const [atividades, setAtividades] = useState<AtividadesPayload | null>(null);
  const [carregandoAtividades, setCarregandoAtividades] = useState(false);
  const [emConstrucao, setEmConstrucao] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  // Presenças têm tela própria: filtro de período + paginação. A lista cresce
  // sem parar (uma linha por passagem no leitor), então nunca vem inteira.
  const [presInicio, setPresInicio] = useState(primeiroDiaDoMes);
  const [presFim, setPresFim] = useState(hoje);
  const [presItens, setPresItens] = useState<Presenca[]>([]);
  const [presTotal, setPresTotal] = useState(0);
  const [presPagina, setPresPagina] = useState(1);
  const [presTemMais, setPresTemMais] = useState(false);
  const [presCarregando, setPresCarregando] = useState(false);

  // Esta tela é clara sempre — ver comentário do topo do arquivo.
  useEffect(() => {
    const root = document.documentElement;
    const eraEscuro = root.classList.contains('dark');
    if (eraEscuro) root.classList.remove('dark');
    return () => { if (eraEscuro) root.classList.add('dark'); };
  }, []);

  useEffect(() => {
    if (!isLoading && !session) navigate('/', { replace: true });
  }, [session, isLoading, navigate]);

  // Ensure table exists + load like count for own profile
  useEffect(() => {
    if (!session?.member_token || !session?.member?.id) return;
    // One-time table setup (idempotent)
    fetch('/api/membro/setup-likes').catch(() => {});
    // Load how many people liked this member
    fetch(`/api/membro/curtir?token=${encodeURIComponent(session.member_token)}&liked_id=${session.member.id}`)
      .then(r => r.json()).then(d => { setLikeCount(d.total ?? 0); }).catch(() => {});
  }, [session?.member?.id, session?.member_token]);

  // Join eclesiástico + GF — o que a sessão do localStorage não tem
  useEffect(() => {
    if (!session?.member_token) return;
    let vivo = true;
    fetch(`/api/membro/perfil?token=${encodeURIComponent(session.member_token)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (vivo && d && !d.error) setPerfil(d); })
      .catch(() => {})
      .finally(() => { if (vivo) setCarregandoPerfil(false); });
    return () => { vivo = false; };
  }, [session?.member_token]);

  // Filhos/presenças/inscrições: só no primeiro toque num dos ícones
  const abrirAba = (qual: Aba) => {
    setAba(qual);
    if (qual === 'presencas') buscarPresencas(1);
    if (atividades || carregandoAtividades || !session?.member_token) return;
    setCarregandoAtividades(true);
    fetch(`/api/membro/atividades?token=${encodeURIComponent(session.member_token)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && !d.error) setAtividades(d); })
      .catch(() => {})
      .finally(() => setCarregandoAtividades(false));
  };

  /**
   * Busca uma página de presenças. `pagina === 1` troca a lista; as seguintes
   * empilham no fim (botão "carregar mais").
   */
  const buscarPresencas = (pagina: number) => {
    if (!session?.member_token) return;
    setPresCarregando(true);
    const q = new URLSearchParams({
      token: session.member_token,
      inicio: presInicio,
      fim: presFim,
      pagina: String(pagina),
    });
    fetch(`/api/membro/presencas?${q}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: (PaginaPresencas & { error?: string }) | null) => {
        if (!d || d.error) return;
        setPresItens(prev => (pagina === 1 ? d.itens : [...prev, ...d.itens]));
        setPresTotal(d.total);
        setPresPagina(d.pagina);
        setPresTemMais(d.temMais);
      })
      .catch(() => {})
      .finally(() => setPresCarregando(false));
  };

  if (isLoading || !session?.member) return null;

  // Os dados frescos do servidor mandam; a sessão cobre o primeiro instante
  // (antes do fetch responder) para a tela não piscar vazia.
  const member = { ...session.member, ...(perfil?.member ?? {}) } as typeof session.member & Partial<PerfilMember>;
  const gf          = perfil?.gf ?? null;
  const funcoes     = perfil?.funcoes ?? [];
  const ministerios = perfil?.ministerios ?? [];
  const batismo     = perfil?.batismo ?? null;

  // Rosa para mulher, azul para homem — sem sexo no cadastro, fica o azul.
  const { accent, soft } = accentPorSexo(member.gender);
  const displayName = toProper(member.preferredName || member.fullName);
  const firstName   = displayName.split(' ')[0];
  const restName    = displayName.split(' ').slice(1).join(' ');
  const churchName  = perfil?.member?.churchName || member.church?.name || '—';
  const campoName   = perfil?.member?.campoName || member.church?.regional?.campo?.name || '—';
  const scolor      = statusColor(member.membershipStatus);
  const gfColor     = gf?.color || accent;
  const endereco    = gf ? gfAddress(gf) : '';
  const horario     = gf ? [gf.meetingDay, gf.meetingTime].filter(Boolean).join(' às ') : '';

  /**
   * Selos — o que a pessoa É na igreja hoje. Nascem do que já existe no
   * cadastro (GF, funções, ministérios, batismo) e a lista cresce sozinha
   * conforme ela assume novas responsabilidades. Treinamentos e cursos
   * (gamificação) entram aqui quando o módulo existir.
   */
  const selos: { label: string; Icon: React.ElementType; cor: string }[] = [
    ...(gf?.vinculo === 'lider' ? [{ label: 'Líder de GF', Icon: Users, cor: gf.color || accent }] : []),
    ...(gf?.vinculo === 'participante' ? [{ label: 'Participa de GF', Icon: Users, cor: gf.color || accent }] : []),
    ...ministerios.filter(m => m.isLeader).map(m => ({ label: `Líder de ${m.name}`, Icon: Sparkles, cor: m.color || accent })),
    ...funcoes.map(f => ({ label: f.name, Icon: Award, cor: accent })),
    ...(batismo ? [{ label: 'Batizado', Icon: Droplets, cor: MEMBRO.OK }] : []),
  ];

  const enderecoMembro = [
    [member.addressStreet, member.addressNumber].filter(Boolean).join(', '),
    member.addressNeighborhood,
    member.addressCity,
  ].filter(Boolean).join(', ');

  /**
   * "Menu" — a grade que absorveu a página de menu.
   *
   * O portal passa a ser UMA tela só: os quatro primeiros abrem modais com os
   * dados da própria pessoa (é a porta de entrada do acompanhamento de
   * ingressos que vem depois) e os demais são os módulos que ficavam no menu.
   * Face ID não entra aqui porque já é o botão principal logo acima.
   */
  const atalhos: {
    key: string; label: string; Icon: React.ElementType;
    aba?: Aba; path?: string; externo?: boolean; construcao?: boolean; total?: number;
  }[] = [
    // Agrupados por assunto, um bloco por linha da grade (5 por linha):
    // 1) devocional  2) igreja e pessoas  3) agenda, ingressos e minha vida.
    // Fora daqui: "Minha ficha" (já é o botão de 3 pontinhos), "Site" (é de
    // onde a pessoa veio), Testemunhos e Eventos (saíram a pedido).
    { key: 'biblia',      label: 'Bíblia',      Icon: BookOpen,      path: '/membro/biblia' },
    { key: 'pao',         label: 'Pão diário',  Icon: Sunrise,       path: '/membro/pao-diario' },
    { key: 'pregacoes',   label: 'Pregações',   Icon: PlayCircle,    path: '/membro/pregacoes' },
    { key: 'radio',       label: 'Rádio',       Icon: Mic,           path: '/radio', externo: true },
    { key: 'feed',        label: 'Feed',        Icon: Send,          path: '/membro/feed' },

    { key: 'ministerio',  label: 'Ministério',  Icon: Flame,         path: '/membro/ministerio' },
    { key: 'lideranca',   label: 'Liderança',   Icon: Users,         path: '/membro/lideranca' },
    { key: 'igreja',      label: 'Igreja',      Icon: Church,        path: '/membro/igreja' },
    { key: 'ebd', construcao: true,         label: 'EBD',         Icon: GraduationCap, },
    { key: 'historia',    label: 'História',    Icon: Clock,         path: '/membro/historia' },
    { key: 'pastoral',    label: 'Atend. Past.', Icon: HeartHandshake, path: '/membro/pastoral' },

    { key: 'agenda',      label: 'Agenda',      Icon: Calendar,      path: '/membro/agenda' },
    { key: 'inscricoes',  label: 'Inscrições',  Icon: Ticket,        aba: 'inscricoes', total: atividades?.totais.inscricoes },
    { key: 'compras',     label: 'Compras',     Icon: ShoppingCart,  path: '/membro/compras' },
    { key: 'presencas',   label: 'Presenças',   Icon: CalendarCheck, aba: 'presencas',  total: atividades?.totais.presencas },
    { key: 'familia',     label: 'Família',     Icon: Baby,          aba: 'familia',    total: atividades?.totais.familia },
    { key: 'membros',     label: 'Membros',     Icon: Users,         path: '/membro/membros' },
  ];

  const tocarAtalho = (a: typeof atalhos[number]) => {
    if (a.aba) return abrirAba(a.aba);
    // Sem tela pronta, avisa aqui mesmo: navegar levaria a uma página vazia,
    // que foi o que essas rotas eram antes de serem removidas.
    if (a.construcao) return setEmConstrucao(a.label);
    if (!a.path) return;
    if (a.externo) window.open(a.path, '_blank');
    else navigate(a.path);
  };

  return (
    <>
      <div
        className="fixed inset-0 flex flex-col"
        style={{ maxWidth: 430, margin: '0 auto', background: BG, overflow: 'hidden', colorScheme: 'light' }}
      >

        {/* ── HERO — a foto ocupa metade da tela (padrão do card do GF) ── */}
        {/* A base da foto é curva — a folha branca encaixa nela logo abaixo */}
        <div
          className="relative flex-shrink-0 overflow-hidden"
          style={{ height: '50%', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}
        >
          <div className="absolute inset-0" style={{ background: '#0f172a' }} />
          {/* SÓ a foto do membro entra aqui. A foto do GF é do grupo, não da
              pessoa — ela vive no card do Grupo Familiar, mais abaixo, e nunca
              serve de retrato de ninguém. Sem foto, mostramos a inicial. */}
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={displayName}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'cover', objectPosition: 'center top' }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/25 font-black" style={{ fontSize: 90 }}>{firstName.charAt(0)}</span>
            </div>
          )}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ height: '55%', background: 'linear-gradient(to top, rgba(2,6,23,0.88), rgba(2,6,23,0))' }}
          />

          <div className="absolute inset-x-0 top-0 flex justify-between px-4 pt-11">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              <ArrowLeft size={16} color="#fff" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLiked(l => !l)}
                className="h-10 px-3 rounded-full flex items-center gap-1.5 transition-all active:scale-90"
                style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                <Heart size={15} fill={liked ? '#f43f5e' : 'none'} color={liked ? '#f43f5e' : '#fff'} />
                <span className="text-[11px] font-bold text-white">{likeCount}</span>
              </button>
              {/* Sair virou ícone no topo — antes era um link no fim da rolagem */}
              <button
                onClick={() => { logout(); navigate('/'); }}
                title="Sair da conta"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                <LogOut size={15} color="#fff" />
              </button>
            </div>
          </div>

          <div className="absolute left-5 right-5 bottom-8">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {member.ecclesiasticalTitle && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-[0.12em] text-white"
                  style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
                >
                  <Star size={8} fill="#fff" color="#fff" /> {member.ecclesiasticalTitle}
                </span>
              )}
              {member.membershipStatus && (
                <span
                  className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide text-white"
                  style={{ background: scolor }}
                >
                  {member.membershipStatus}
                </span>
              )}
            </div>
            {/* ROL ao lado do nome — era um card só para ele antes */}
            <div className="flex items-end gap-2 flex-wrap">
              <h1 className="text-white font-bold leading-tight" style={{ fontSize: 26 }}>{firstName}</h1>
              {member.rol && (
                <span
                  className="mb-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums text-white"
                  style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
                >
                  ROL #{member.rol}
                </span>
              )}
            </div>
            {restName && <h2 className="text-white/85 font-medium leading-tight" style={{ fontSize: 14 }}>{restName}</h2>}
            <p className="text-white/70 text-[11px] font-medium mt-0.5">{churchName} · {campoName}</p>
          </div>
        </div>

        {/* ── FOLHA — rolagem ── */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ background: BG, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -10, scrollbarWidth: 'none' }}
        >
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-9 h-1 rounded-full" style={{ background: '#cbd5e1' }} />
          </div>

          <div className="px-4 pb-10 space-y-3 pt-1">

            {/* Ações rápidas — Face ID continua sendo o botão principal */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => navigate('/membro/faceid')}
                className="flex-1 flex items-center justify-center gap-2 font-bold rounded-full h-12 transition-all active:scale-95"
                style={{ background: accent, color: '#fff', fontSize: 13.5, boxShadow: `0 6px 18px ${accent}45` }}
              >
                <ScanFace size={17} />
                Cadastrar foto
              </button>
              {/* O antigo botão de "todos os recursos" saiu: os módulos agora
                  moram na grade do Menu, logo abaixo. "Ver membros do
                  campo" virou este ícone — era um botão grande no rodapé. */}
              {/* Joystick: a porta do "Mundo da Bíblia". Fica fora da grade e
                  em destaque de propósito — é o convite mais chamativo da tela. */}
              <button
                onClick={() => setEmConstrucao('Mundo da Bíblia')}
                title="Mundo da Bíblia"
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                style={{ background: accent, boxShadow: `0 6px 18px ${accent}55` }}
              >
                <Gamepad2 size={19} color="#fff" />
              </button>
              {/* Dízimos e ofertas: subiu da grade para cá e fica pulsando —
                  é a ação que a igreja mais quer à mão. "Ver membros do campo"
                  desceu para a grade no lugar dele. */}
              <button
                onClick={() => abrirAba('doacao')}
                title="Dízimos e ofertas"
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 animate-pulse"
                style={{ background: MEMBRO.OK, boxShadow: `0 6px 18px ${MEMBRO.OK}55` }}
              >
                <HandCoins size={19} color="#fff" />
              </button>
              <button
                onClick={() => setShowDetails(true)}
                title="Minha ficha completa"
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}
              >
                <MoreHorizontal size={18} color={TEXT2} />
              </button>
            </div>

            {/* ── MENU — só os ícones, sem título e sem card por item.
                O rótulo "Menu" saiu: a grade é a única coisa nesta faixa, não
                precisa de placa. Quatro por linha para o ícone e o texto
                caberem maiores sem apertar. ── */}
            <section
              className="rounded-2xl px-3 py-4"
              style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}
            >
              <div className="grid grid-cols-4 gap-x-2 gap-y-4 justify-items-center">
                {atalhos.map(a => (
                  <button
                    key={a.key}
                    onClick={() => tocarAtalho(a)}
                    className="relative w-full flex flex-col items-center gap-1.5 transition-transform active:scale-90"
                  >
                    <span
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: soft }}
                    >
                      <a.Icon size={21} color={accent} />
                    </span>
                    <span className="text-[10px] font-semibold leading-tight text-center" style={{ color: TEXT2 }}>
                      {a.label}
                    </span>
                    {a.total !== undefined && a.total > 0 && (
                      <span
                        className="absolute -top-1 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center"
                        style={{ background: accent, left: 'calc(50% + 10px)' }}
                      >
                        {a.total > 99 ? '99+' : a.total}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* ── Mapa do GF (mesmo embed sem chave de API do resto do site) ── */}
      {mapaAberto && gf && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ colorScheme: 'light' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(2,6,23,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setMapaAberto(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <h3 className="text-sm font-bold" style={{ color: TEXT1 }}>{gf.name}</h3>
              <button onClick={() => setMapaAberto(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: BG }}>
                <X size={14} color={TEXT2} />
              </button>
            </div>
            <iframe title={`Mapa - ${gf.name}`} src={buildMapEmbedUrl(gf)} className="w-full h-64 border-0 block" loading="lazy" />
            <div className="p-4 flex items-center justify-between gap-3">
              <p className="text-[11px] flex-1" style={{ color: TEXT2 }}>{endereco}</p>
              <a
                href={buildMapsLink(gf)} target="_blank" rel="noreferrer"
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
                style={{ background: gfColor }}
              >
                Abrir no Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Modais dos ícones ── */}
      <AnimatePresence>
        {aba === 'familia' && (
          <Bandeja titulo="Minha família" onClose={() => setAba(null)}>
            {carregandoAtividades && !atividades ? (
              <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin" color={accent} /></div>
            ) : atividades?.familia.length ? (
              <div className="space-y-2.5">
                {atividades.familia.map(f => (
                  <div key={f.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: BG }}>
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: soft }}>
                      {f.photoUrl ? <img src={f.photoUrl} alt={f.name} className="w-full h-full object-cover" /> : <Baby size={16} color={accent} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-bold truncate" style={{ color: TEXT1 }}>{toProper(f.name)}</p>
                      <p className="text-[10.5px]" style={{ color: TEXT2 }}>
                        {[f.parentesco,
                          f.idade !== null ? `${f.idade} ${f.idade === 1 ? 'ano' : 'anos'}` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {f.ehMembro && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold text-white flex-shrink-0" style={{ background: accent }}>
                        {f.rol ? `#${f.rol}` : 'MEMBRO'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Vazio texto="Nenhum familiar cadastrado na sua ficha. Fale com a secretaria para incluir seu núcleo familiar." />
            )}
          </Bandeja>
        )}

        {aba === 'presencas' && (
          <Bandeja titulo="Minhas presenças" onClose={() => setAba(null)}>
            {/* Filtro de período: o padrão é o mês corrente. Sem ele a lista
                viria com o histórico inteiro do leitor facial. */}
            <div className="rounded-2xl p-3 mb-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] mb-2" style={{ color: accent }}>
                Período
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={presInicio}
                  onChange={e => setPresInicio(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-2 rounded-xl text-[12px] font-semibold outline-none"
                  style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT1 }}
                />
                <span className="text-[11px] flex-shrink-0" style={{ color: TEXT2 }}>até</span>
                <input
                  type="date"
                  value={presFim}
                  onChange={e => setPresFim(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-2 rounded-xl text-[12px] font-semibold outline-none"
                  style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT1 }}
                />
              </div>
              <button
                onClick={() => buscarPresencas(1)}
                disabled={presCarregando}
                className="w-full mt-2.5 py-2.5 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ background: accent }}
              >
                {presCarregando ? <Loader2 size={13} className="animate-spin" /> : <CalendarCheck size={13} />}
                Buscar
              </button>
            </div>

            {presCarregando && presItens.length === 0 ? (
              <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin" color={accent} /></div>
            ) : presItens.length ? (
              <>
                <p className="text-[10.5px] mb-2" style={{ color: TEXT2 }}>
                  Mostrando {presItens.length} de {presTotal} {presTotal === 1 ? 'presença' : 'presenças'} no período
                </p>
                <div className="space-y-1.5">
                  {presItens.map(p => (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: BG }}>
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: p.origem === 'leitor' ? `${accent}14` : `${MEMBRO.OK}14` }}>
                        {p.origem === 'leitor'
                          ? <ScanFace size={15} color={accent} />
                          : <CalendarCheck size={15} color={MEMBRO.OK} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold truncate" style={{ color: TEXT1 }}>{p.titulo}</p>
                        <p className="text-[10.5px] truncate" style={{ color: TEXT2 }}>
                          {formatDateTime(p.data)}{p.detalhe ? ` · ${p.detalhe}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {presTemMais && (
                  <button
                    onClick={() => buscarPresencas(presPagina + 1)}
                    disabled={presCarregando}
                    className="w-full mt-3 py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ background: soft, color: accent }}
                  >
                    {presCarregando && <Loader2 size={13} className="animate-spin" />}
                    Carregar mais
                  </button>
                )}
              </>
            ) : (
              <Vazio texto="Nenhuma presença neste período. Mude as datas acima ou cadastre seu rosto no Face ID para que sua presença seja marcada automaticamente." />
            )}
          </Bandeja>
        )}

        {aba === 'inscricoes' && (
          <Bandeja titulo="Eventos e inscrições" onClose={() => setAba(null)}>
            {carregandoAtividades && !atividades ? (
              <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin" color={accent} /></div>
            ) : atividades?.inscricoes.length ? (
              <div className="space-y-2.5">
                {atividades.inscricoes.map(i => (
                  <div key={i.id} className="rounded-xl px-3 py-3" style={{ background: BG }}>
                    <div className="flex items-start gap-2">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: soft }}>
                        <Ticket size={15} color={accent} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-bold leading-snug" style={{ color: TEXT1 }}>{i.titulo}</p>
                        <p className="text-[10.5px] mt-0.5" style={{ color: TEXT2 }}>
                          {[i.inicio ? formatDateTime(i.inicio) : null, i.local].filter(Boolean).join(' · ') || 'Sem data definida'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {i.status && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase text-white" style={{ background: accent }}>
                              {i.status}
                            </span>
                          )}
                          {i.pagamento && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase text-white" style={{ background: MEMBRO.WARN }}>
                              {i.pagamento}{i.valor ? ` · R$ ${i.valor.toFixed(2).replace('.', ',')}` : ''}
                            </span>
                          )}
                          {i.compareceu && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase text-white" style={{ background: MEMBRO.OK }}>
                              Presente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Vazio texto="Você ainda não tem inscrição em nenhum evento. Suas compras de ingresso também vão aparecer aqui." />
            )}
          </Bandeja>
        )}

        {aba === 'doacao' && (
          <Bandeja titulo="Dízimos e ofertas" onClose={() => setAba(null)}>
            {carregandoAtividades && !atividades ? (
              <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin" color={accent} /></div>
            ) : atividades?.doacao ? (
              <div className="space-y-3">
                <p className="text-[12px] leading-relaxed" style={{ color: TEXT2 }}>
                  Sua entrega vai direto para a conta da igreja — copie a chave e
                  faça a transferência pelo seu banco. O portal não recebe o valor.
                </p>

                {atividades.doacao.pix ? (
                  <div className="rounded-2xl p-4" style={{ background: soft, border: `1px solid ${accent}22` }}>
                    <p className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] mb-1" style={{ color: accent }}>
                      Chave PIX
                    </p>
                    <p className="text-[14px] font-bold break-all" style={{ color: TEXT1 }}>{atividades.doacao.pix}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(atividades.doacao!.pix!).then(
                          () => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); },
                          () => {},
                        );
                      }}
                      className="w-full mt-3 py-2.5 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-1.5"
                      style={{ background: accent }}
                    >
                      {copiado ? <><Check size={13} /> Chave copiada</> : <><Copy size={13} /> Copiar chave PIX</>}
                    </button>
                  </div>
                ) : (
                  <Vazio texto="A igreja ainda não cadastrou uma chave PIX. Fale com a secretaria." />
                )}

                <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  {/* CNPJ e e-mail ficam de fora de propósito: quem vai
                      transferir precisa da chave, do banco e de com quem falar.
                      O resto só polui a tela. */}
                  {([
                    ['Igreja', atividades.doacao.churchName],
                    ['Banco', atividades.doacao.bank],
                    ['Endereço', atividades.doacao.endereco],
                    ['WhatsApp', atividades.doacao.whatsapp || atividades.doacao.contact],
                  ].filter(([, v]) => !!v) as [string, string][]).map(([lbl, val], i) => (
                    <div key={lbl} className="flex justify-between gap-4 px-4 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : undefined }}>
                      <span className="text-[11px] font-medium flex-shrink-0" style={{ color: TEXT2 }}>{lbl}</span>
                      <span className="text-[12px] font-semibold text-right break-all" style={{ color: TEXT1 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Vazio texto="A igreja do seu campo ainda não tem os dados de dízimos cadastrados. Fale com a secretaria." />
            )}
          </Bandeja>
        )}

        {emConstrucao && (
          <Bandeja titulo={emConstrucao} onClose={() => setEmConstrucao(null)}>
            <div className="py-4 text-center">
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: soft }}>
                <Hammer size={24} color={accent} />
              </div>
              <p className="text-[14px] font-bold mb-1.5" style={{ color: TEXT1 }}>Estamos preparando esta área</p>
              <p className="text-[12px] leading-relaxed" style={{ color: TEXT2 }}>
                {emConstrucao} ainda não está disponível no portal. Assim que ficar
                pronta, ela aparece aqui para você.
              </p>
              <button
                onClick={() => setEmConstrucao(null)}
                className="w-full mt-5 py-3 rounded-xl text-[12px] font-bold text-white"
                style={{ background: accent }}
              >
                Entendi
              </button>
            </div>
          </Bandeja>
        )}

        {/* ── Ficha completa ── */}
        {showDetails && (
          <Bandeja titulo="Meu perfil" onClose={() => setShowDetails(false)}>
              {/* Trilha do membro — o que ele ainda vai poder fazer aqui dentro.
                  Nenhum destes módulos existe: por ora avisam "em construção".
                  Fecha a bandeja antes para os dois modais não se empilharem. */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { label: 'Treinamento de GF', Icon: GraduationCap },
                  { label: 'Cursos',            Icon: Library },
                  { label: 'Mundo da Bíblia',   Icon: Gamepad2 },
                ].map(t => (
                  <button
                    key={t.label}
                    onClick={() => { setShowDetails(false); setEmConstrucao(t.label); }}
                    className="rounded-2xl py-3 flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                    style={{ background: soft, border: `1px solid ${accent}22` }}
                  >
                    <t.Icon size={20} color={accent} />
                    <span className="text-[9.5px] font-bold leading-tight text-center px-1" style={{ color: accent }}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* ── SELOS — o que a pessoa é na igreja. A lista cresce conforme
                  ela assume funções; treinamentos e cursos entram aqui depois. ── */}
              {selos.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: accent }}>
                    Seus selos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selos.map(sl => (
                      <span
                        key={sl.label}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10.5px] font-bold"
                        style={{ background: `${sl.cor}14`, color: sl.cor, border: `1px solid ${sl.cor}33` }}
                      >
                        <sl.Icon size={11} /> {sl.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-4">
  {/* ── GRUPO FAMILIAR — só existe se a pessoa lidera ou participa ── */}
  {gf && (
    <section className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
      <div className="px-4 py-3.5 text-white" style={{ background: gfColor }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-white/80">
            {gf.vinculo === 'lider' ? 'Você lidera este GF' : 'Seu Grupo Familiar'}
          </p>
          {gf.cellType && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ background: 'rgba(255,255,255,0.22)' }}>
              {gf.cellType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          {gf.photo && (
            <img src={gf.photo} alt={gf.name} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" style={{ border: '2px solid rgba(255,255,255,0.6)' }} />
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight truncate">{gf.name}</h2>
            {horario && <p className="text-[11px] font-medium text-white/85">{horario}</p>}
          </div>
        </div>
        {gf.vinculo === 'lider' && (
          <p className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Users size={11} /> {gf.memberCount} {gf.memberCount === 1 ? 'participante' : 'participantes'}
          </p>
        )}
      </div>

      {/* líderes: o casal quando houver, cada um com o WhatsApp */}
      {gf.leaders.length > 0 && (
        <>
          <p className="px-4 pt-3 pb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: gfColor }}>
            {gf.leaders.length > 1 ? 'Líderes' : 'Líder'}
          </p>
          <div className="px-4 pb-3 space-y-2">
            {gf.leaders.map(l => (
              <div key={l.id} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: `${gfColor}14`, border: `1.5px solid ${gfColor}` }}>
                  {l.photoUrl
                    ? <img src={l.photoUrl} alt={l.name} className="w-full h-full object-cover" />
                    : <Users size={14} color={gfColor} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold truncate" style={{ color: TEXT1 }}>{toProper(l.name)}</p>
                  {l.phone && <p className="text-[10.5px] truncate" style={{ color: TEXT2 }}>{l.phone}</p>}
                </div>
                {l.phone && l.id !== member.id && (
                  <a
                    href={waLink(l.phone, `Olá! Falo do GF "${gf.name}" 🙂`)}
                    target="_blank" rel="noreferrer"
                    title={`Falar com ${l.name}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white active:scale-90 transition-transform"
                    style={{ background: gfColor }}
                  >
                    <Phone size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {endereco && (
        <>
          <Divisor />
          <Linha Icon={MapPin} label="Ver no mapa" value={endereco} tint={gfColor} onClick={() => setMapaAberto(true)} />
        </>
      )}
    </section>
  )}

  {/* ── VIDA ECLESIÁSTICA — só quando existe algo para mostrar ── */}
  {funcoes.length > 0 && (
    <Secao accent={accent} titulo={funcoes.length > 1 ? 'Funções na igreja' : 'Função na igreja'}>
      <div className="pb-1">
        {funcoes.map((f, i) => (
          <React.Fragment key={f.id}>
            {i > 0 && <Divisor />}
            <Linha
              tint={accent}
              Icon={Award}
              label={[f.department, f.isCampoWide ? 'todo o campo' : null].filter(Boolean).join(' · ') || 'Desde ' + formatDate(f.startDate)}
              value={f.name}
            />
          </React.Fragment>
        ))}
      </div>
    </Secao>
  )}

  {ministerios.length > 0 && (
    <Secao accent={accent} titulo={ministerios.length > 1 ? 'Ministérios' : 'Ministério'}>
      <div className="pb-1">
        {ministerios.map((m, i) => (
          <React.Fragment key={m.id}>
            {i > 0 && <Divisor />}
            <Linha
              Icon={Sparkles}
              tint={m.color || accent}
              label={m.isLeader ? 'Você lidera' : (m.role || 'Participante')}
              value={m.name}
            />
          </React.Fragment>
        ))}
      </div>
    </Secao>
  )}

  {batismo && (
    <Secao accent={accent} titulo="Batismo">
      <div className="pb-1">
        <Linha tint={accent} Icon={Droplets} label="Data" value={formatDate(batismo.date)} />
        {batismo.location && <><Divisor /><Linha tint={accent} Icon={MapPin} label="Local" value={batismo.location} /></>}
        {batismo.ministerName && <><Divisor /><Linha tint={accent} Icon={Users} label="Ministrante" value={toProper(batismo.ministerName)} /></>}
      </div>
    </Secao>
  )}
              </div>

            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: accent }}>
              Meus dados
            </p>
            <div className="space-y-2.5">
              {([
                ['ROL', member.rol ? String(member.rol) : '—'],
                ['Nome completo', toProper(member.fullName)],
                ['Nome preferido', member.preferredName ? toProper(member.preferredName) : '—'],
                ['Título eclesiástico', member.ecclesiasticalTitle || '—'],
                ['Status', member.membershipStatus || '—'],
                ['Gênero', member.gender || '—'],
                ['Estado civil', member.maritalStatus || '—'],
                ['Nacionalidade', member.nationality || '—'],
                ['Nascimento', formatDate(member.birthDate)],
                ['Profissão', member.occupation || '—'],
                ['Nome do pai', member.fatherName ? toProper(member.fatherName) : '—'],
                ['Nome da mãe', member.motherName ? toProper(member.motherName) : '—'],
                ['Cônjuge', member.spouseName ? toProper(member.spouseName) : '—'],
                ['Email', member.email || '—'],
                ['Celular', member.mobile || member.phone || '—'],
                ['Endereço', enderecoMembro || '—'],
                ['Igreja', churchName],
                ['Campo', campoName],
                ['Grupo Familiar', gf ? `${gf.name}${gf.vinculo === 'lider' ? ' (líder)' : ''}` : '—'],
                ['Membro desde', formatDate(member.membershipDate)],
                ['Data de batismo', formatDate(batismo?.date ?? member.baptismDate)],
              ] as [string, string][]).map(([lbl, val]) => (
                <div key={lbl} className="flex justify-between gap-4 pb-2.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <span className="text-[11px] font-medium" style={{ color: TEXT2 }}>{lbl}</span>
                  <span className="text-[12px] font-semibold text-right" style={{ color: TEXT1 }}>{val}</span>
                </div>
              ))}
              <button
                onClick={() => { setShowDetails(false); navigate('/membro/pastoral'); }}
                className="w-full flex items-center justify-center gap-1.5 mt-2 py-3 rounded-xl text-[12px] font-bold"
                style={{ background: soft, color: accent }}
              >
                Algum dado errado? Fale com a secretaria <ChevronRight size={13} />
              </button>
            </div>
          </Bandeja>
        )}
      </AnimatePresence>
    </>
  );
}
