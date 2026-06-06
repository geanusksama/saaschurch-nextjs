import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cake, BookOpen, Heart, Calendar, CalendarDays, UserPlus,
  X, MessageCircle, Loader2, MapPin, Clock, Phone,
  Calculator, StickyNote, BookMarked, ChevronLeft, ChevronRight,
  Plus, Bold, Italic, Underline, List, ListOrdered,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BirthdayMember {
  id: string;
  name: string;
  day: number;
  age: number;
  phone: string | null;
  photoUrl: string | null;
  church: string | null;
  today: boolean;
  daysUntil: number;
}

interface BibleVerse {
  text: string;
  reference: string;
}

interface Campaign {
  name: string;
  color: string;
  textColor: string;
  description: string;
  tip: string;
}

interface Holiday {
  date: string;
  name: string;
  type: string;
}

interface ChurchEvent {
  id: string;
  evento: string;
  datareal: string;
  horario: string | null;
  local: string | null;
  dia: number;
  mes: string;
}

interface NewMember {
  id: string;
  fullName: string;
  preferredName: string | null;
  mobile: string | null;
  phone: string | null;
  photoUrl: string | null;
  memberType: string | null;
  membershipStatus: string | null;
  createdAt: string;
  church: { name: string } | null;
}

interface StickyNoteItem {
  id: string;
  content: string;
  color: string;
  position: number;
}

type WidgetId = 'birthdays' | 'bible' | 'campaigns' | 'holidays' | 'events' | 'newMembers' | 'calculator' | 'agenda' | 'notes';

export interface QuickWidgetsProps {
  churchId?: string;
  campoId?: string;
  notesOpen?: boolean;
  onToggleNotes?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAMPAIGNS_BY_MONTH: Record<number, Campaign[]> = {
  1: [{ name: 'Janeiro Branco', color: '#f0f0f0', textColor: '#333', description: 'Prevenção e conscientização em saúde mental.', tip: 'Cuide da saúde emocional. Busque ajuda quando precisar.' }],
  2: [{ name: 'Fevereiro Roxo', color: '#7b2d8b', textColor: '#fff', description: 'Conscientização sobre Alzheimer, fibromialgia e lúpus.', tip: 'Conheça os sintomas e apoie quem precisa de cuidado.' }],
  3: [{ name: 'Março Azul-Marinho', color: '#003366', textColor: '#fff', description: 'Prevenção do câncer colorretal.', tip: 'Faça exames preventivos regularmente.' }],
  4: [
    { name: 'Abril Verde', color: '#2d7a2d', textColor: '#fff', description: 'Prevenção de acidentes de trabalho.', tip: 'Segurança no trabalho é responsabilidade de todos.' },
    { name: 'Abril Azul', color: '#4a86c8', textColor: '#fff', description: 'Conscientização sobre o Autismo.', tip: 'Promova a inclusão e o respeito às diferenças.' },
  ],
  5: [
    { name: 'Maio Amarelo', color: '#f5c518', textColor: '#333', description: 'Prevenção de acidentes de trânsito.', tip: 'Respeite as leis de trânsito e salve vidas.' },
    { name: 'Maio Roxo', color: '#6a0dad', textColor: '#fff', description: 'Conscientização sobre lúpus e fibromialgia.', tip: 'Divulgue informações e apoie quem convive com essas doenças.' },
  ],
  6: [{ name: 'Junho Vermelho', color: '#cc0000', textColor: '#fff', description: 'Mês mundial do doador de sangue.', tip: 'Doe sangue. Um gesto simples que pode salvar vidas.' }],
  7: [{ name: 'Julho Verde', color: '#1a7a1a', textColor: '#fff', description: 'Doação de órgãos.', tip: 'Seja um doador de órgãos e dê uma nova chance de vida.' }],
  8: [{ name: 'Agosto Dourado', color: '#f4c430', textColor: '#333', description: 'Aleitamento materno.', tip: 'O leite materno é o melhor alimento para o bebê.' }],
  9: [
    { name: 'Setembro Amarelo', color: '#f5c518', textColor: '#333', description: 'Prevenção ao suicídio. A vida é o maior bem que temos.', tip: 'Se alguém precisar conversar, esteja presente. Cuide-se e cuide do próximo.' },
    { name: 'Setembro Verde', color: '#2d7a2d', textColor: '#fff', description: 'Doação de órgãos e tecidos.', tip: 'Fale com sua família sobre a importância da doação.' },
  ],
  10: [
    { name: 'Outubro Rosa', color: '#e75480', textColor: '#fff', description: 'Prevenção do câncer de mama.', tip: 'Faça o autoexame e realize mamografias regularmente.' },
    { name: 'Outubro Azul', color: '#4a86c8', textColor: '#fff', description: 'Prevenção do câncer de próstata.', tip: 'Homens: consulte um médico e faça exames preventivos.' },
  ],
  11: [
    { name: 'Novembro Azul', color: '#4a86c8', textColor: '#fff', description: 'Prevenção do câncer de próstata.', tip: 'Cuide da saúde masculina. Faça exames regularmente.' },
    { name: 'Novembro Negro', color: '#1a1a1a', textColor: '#fff', description: 'Consciência negra e combate ao racismo.', tip: 'Valorize a diversidade e combata o preconceito.' },
  ],
  12: [{ name: 'Dezembro Vermelho', color: '#cc0000', textColor: '#fff', description: 'Prevenção ao HIV/AIDS.', tip: 'Proteja-se e informe-se sobre prevenção.' }],
};

const VERSE_REFS = [
  'john+3:16', 'philippians+4:13', 'romans+8:28', 'jeremiah+29:11',
  'psalm+23:1', 'isaiah+40:31', 'matthew+6:33', 'proverbs+3:5-6',
  'psalm+46:1', 'romans+12:2', 'isaiah+41:10', 'psalm+27:1',
  'john+14:6', 'matthew+11:28', 'john+16:33', 'romans+5:8',
  'psalm+91:1-2', 'hebrews+11:1', 'joshua+1:9', 'psalm+37:4',
  'proverbs+22:6', 'matthew+5:14', 'romans+3:23', 'ephesians+2:8-9',
  'philippians+4:7', 'colossians+3:23', 'james+1:2-3', '1peter+5:7',
  'psalm+119:105', 'isaiah+53:5', 'romans+6:23', 'john+15:13',
  'matthew+22:37-39', 'revelation+21:4', 'philippians+4:19', 'psalm+34:8',
  'isaiah+43:2', 'luke+6:31', 'matthew+28:19-20', 'john+10:10',
  'romans+8:38-39', 'psalm+16:8', 'proverbs+18:10', '2timothy+1:7',
  'luke+1:37', 'psalm+100:4', 'john+3:36', 'ephesians+4:32',
  'psalm+51:10', 'romans+10:9', 'james+4:7', 'galatians+5:22-23',
  'colossians+1:16', '1thessalonians+5:17', 'psalm+34:18', 'isaiah+26:3',
  'matthew+6:34', 'john+8:32', 'psalm+9:1', 'proverbs+4:23',
];

const NOTE_COLORS = [
  { bg: '#fef08a', label: 'Amarelo' },
  { bg: '#fecaca', label: 'Vermelho' },
  { bg: '#bbf7d0', label: 'Verde' },
  { bg: '#bfdbfe', label: 'Azul' },
  { bg: '#e9d5ff', label: 'Roxo' },
  { bg: '#fed7aa', label: 'Laranja' },
];

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS_SHORT = ['D','S','T','Q','Q','S','S'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return '55' + digits;
}

function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const formatted = formatPhone(phone);
  if (!formatted) return null;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function daysUntilDate(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('mrm_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function authFetch(url: string): Promise<Response> {
  return fetch(url, { headers: authHeaders() });
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function ModalShell({ title, icon: Icon, iconColor, onClose, children }: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700">
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm">Carregando...</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>;
}

// ─── Rich Text Editor ─────────────────────────────────────────────────────────

const EDITOR_COLORS = ['#1e293b', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

function RichEditor({ value, onChange, placeholder, minHeight = 120 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value || '';
      initialized.current = true;
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(ref.current?.innerHTML || '');
  };

  const TBtn = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-600"
    >
      {children}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/60">
        <TBtn onClick={() => exec('bold')} title="Negrito"><Bold className="h-3.5 w-3.5 font-bold" /></TBtn>
        <TBtn onClick={() => exec('italic')} title="Itálico"><Italic className="h-3.5 w-3.5" /></TBtn>
        <TBtn onClick={() => exec('underline')} title="Sublinhado"><Underline className="h-3.5 w-3.5" /></TBtn>
        <div className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <TBtn onClick={() => exec('insertUnorderedList')} title="Lista"><List className="h-3.5 w-3.5" /></TBtn>
        <TBtn onClick={() => exec('insertOrderedList')} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></TBtn>
        <div className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        {EDITOR_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c); }}
            className="h-4 w-4 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110"
            style={{ background: c }}
            title={`Cor ${c}`}
          />
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || '')}
        data-placeholder={placeholder || 'Digite aqui...'}
        style={{ minHeight }}
        className="p-3 text-sm text-slate-800 outline-none dark:text-slate-200 [&:empty::before]:text-slate-400 [&:empty::before]:content-[attr(data-placeholder)]"
      />
    </div>
  );
}

// ─── Birthdays Modal ──────────────────────────────────────────────────────────

function MemberCard({ member, messageTemplate, highlight = false }: {
  member: BirthdayMember;
  messageTemplate: string;
  highlight?: boolean;
}) {
  const waLink = whatsappLink(member.phone, messageTemplate);
  return (
    <div className={`flex items-center gap-3 rounded-xl p-3 ${highlight ? 'bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-900/20 dark:ring-rose-800' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-sm font-bold text-white">
        {member.photoUrl ? <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" /> : member.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{member.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {member.today ? `Hoje • ${member.age} anos` : `Em ${member.daysUntil} dia${member.daysUntil !== 1 ? 's' : ''} • ${member.age} anos`}
          {member.church && ` • ${member.church}`}
        </p>
      </div>
      {waLink && (
        <a href={waLink} target="_blank" rel="noopener noreferrer" title="Enviar parabéns pelo WhatsApp"
          className="flex shrink-0 items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600">
          <MessageCircle className="h-3 w-3" /> Parabéns
        </a>
      )}
    </div>
  );
}

function BirthdaysModal({ loading, data, onClose }: {
  loading: boolean;
  data: { today: BirthdayMember[]; week: BirthdayMember[] } | null;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Aniversariantes" icon={Cake} iconColor="bg-rose-100 text-rose-500 dark:bg-rose-900/40 dark:text-rose-300" onClose={onClose}>
      {loading ? <LoadingState /> : !data ? <EmptyState message="Erro ao carregar." /> : (
        <div className="space-y-4">
          {data.today.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">Hoje 🎂</h4>
              <div className="space-y-2">{data.today.map(m => <MemberCard key={m.id} member={m} messageTemplate={`Olá ${m.name}, feliz aniversário! 🎂 Que Deus abençoe muito a sua vida! 🙏`} highlight />)}</div>
            </section>
          )}
          {data.week.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Esta Semana</h4>
              <div className="space-y-2">{data.week.map(m => <MemberCard key={m.id} member={m} messageTemplate={`Olá ${m.name}, antecipamos os votos de feliz aniversário! 🎂 Que Deus abençoe! 🙏`} />)}</div>
            </section>
          )}
          {data.today.length === 0 && data.week.length === 0 && <EmptyState message="Nenhum aniversariante hoje ou esta semana." />}
        </div>
      )}
    </ModalShell>
  );
}

// ─── Bible Modal ──────────────────────────────────────────────────────────────

function BibleModal({ loading, data, onClose }: { loading: boolean; data: BibleVerse | null; onClose: () => void }) {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <ModalShell title="Palavra do Dia" icon={BookOpen} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" onClose={onClose}>
      {loading ? <LoadingState /> : !data ? <EmptyState message="Não foi possível carregar o versículo. Verifique sua conexão." /> : (
        <div className="space-y-4">
          <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{today}</p>
          <blockquote className="rounded-xl border-l-4 border-amber-400 bg-amber-50 px-5 py-4 dark:bg-amber-900/20">
            <p className="text-base italic leading-relaxed text-slate-800 dark:text-slate-100">"{data.text}"</p>
          </blockquote>
          <p className="text-right text-sm font-semibold text-amber-600 dark:text-amber-400">{data.reference}</p>
          <p className="text-right text-xs text-slate-400">Tradução: Almeida</p>
        </div>
      )}
    </ModalShell>
  );
}

// ─── Campaigns Modal ──────────────────────────────────────────────────────────

function CampaignsModal({ campaigns, onClose }: { campaigns: Campaign[]; onClose: () => void }) {
  const monthName = MONTHS_PT[new Date().getMonth()];
  return (
    <ModalShell title={`Campanhas de ${monthName}`} icon={Heart} iconColor="bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300" onClose={onClose}>
      {campaigns.length === 0 ? <EmptyState message="Nenhuma campanha este mês." /> : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-xl" style={{ background: c.color }}>
              <div className="px-4 py-3">
                <h4 className="text-base font-bold" style={{ color: c.textColor }}>{c.name}</h4>
                <p className="mt-1 text-sm opacity-90" style={{ color: c.textColor }}>{c.description}</p>
              </div>
              <div className="border-t border-white/20 bg-black/10 px-4 py-2.5">
                <p className="text-xs font-medium" style={{ color: c.textColor }}>💡 {c.tip}</p>
              </div>
            </div>
          ))}
          <p className="pt-2 text-center text-xs text-slate-400">Compartilhe com os membros da sua igreja.</p>
        </div>
      )}
    </ModalShell>
  );
}

// ─── Holidays Modal ───────────────────────────────────────────────────────────

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_COLORS: Record<number, string> = {
  0: 'text-red-500',   // domingo
  6: 'text-orange-500', // sábado
};

function holidayWeekday(dateStr: string): { short: string; colorClass: string; isWeekend: boolean } {
  const d = new Date(dateStr + 'T12:00:00');
  const idx = d.getDay();
  return {
    short: WEEKDAYS_PT[idx],
    colorClass: WEEKDAY_COLORS[idx] ?? 'text-slate-400',
    isWeekend: idx === 0 || idx === 6,
  };
}

function HolidaysModal({ loading, data, onClose }: { loading: boolean; data: Holiday[] | null; onClose: () => void }) {
  const year = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];
  return (
    <ModalShell title={`Feriados Nacionais ${year}`} icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" onClose={onClose}>
      {loading ? <LoadingState /> : !data ? <EmptyState message="Não foi possível carregar os feriados." /> : (
        <div className="space-y-1.5">
          {data.map((h) => {
            const days = daysUntilDate(h.date);
            const isToday = h.date === todayStr;
            const isPast = days < 0;
            const { short: weekday, colorClass: wdColor, isWeekend } = holidayWeekday(h.date);
            return (
              <div key={h.date} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${isToday ? 'bg-blue-100 ring-1 ring-blue-300 dark:bg-blue-900/40 dark:ring-blue-700' : isPast ? 'opacity-40' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
                <div className="w-20 shrink-0 text-center">
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{formatDateBR(h.date)}</p>
                  <p className={`text-[10px] font-semibold ${wdColor}`}>
                    {weekday}{isWeekend && ' 🎉'}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${isPast ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{h.name}</p>
                  <p className="text-xs capitalize text-slate-400">{h.type}</p>
                </div>
                {isToday && <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">Hoje</span>}
                {!isToday && !isPast && (
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-green-600 dark:text-green-400">
                    em {days}d
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

// ─── Events Modal ─────────────────────────────────────────────────────────────

function EventsModal({ loading, data, onClose }: { loading: boolean; data: ChurchEvent[] | null; onClose: () => void }) {
  const todayStr = new Date().toISOString().split('T')[0];
  return (
    <ModalShell title="Próximos Eventos" icon={CalendarDays} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300" onClose={onClose}>
      {loading ? <LoadingState /> : !data ? <EmptyState message="Não foi possível carregar os eventos." /> : data.length === 0 ? <EmptyState message="Nenhum evento programado." /> : (
        <div className="space-y-2">
          {data.slice(0, 20).map((ev) => {
            const isToday = ev.datareal.split('T')[0] === todayStr;
            return (
              <div key={ev.id} className={`rounded-xl p-3 ${isToday ? 'bg-purple-50 ring-1 ring-purple-200 dark:bg-purple-900/20 dark:ring-purple-800' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-purple-600 py-1.5 text-white">
                    <span className="text-lg font-bold leading-none">{ev.dia}</span>
                    <span className="text-[10px] font-medium uppercase">{ev.mes.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{ev.evento}</p>
                    {ev.horario && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" /> {ev.horario}</p>}
                    {ev.local && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" /> {ev.local}</p>}
                  </div>
                  {isToday && <span className="shrink-0 rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-bold text-white">Hoje</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

// ─── New Members Modal ────────────────────────────────────────────────────────

function NewMembersModal({ loading, data, onClose }: { loading: boolean; data: NewMember[] | null; onClose: () => void }) {
  const monthName = MONTHS_PT[new Date().getMonth()];
  const filtered = data?.filter(m => m.memberType?.toUpperCase() !== 'PJ') ?? [];
  return (
    <ModalShell title={`Novos Membros — ${monthName}`} icon={UserPlus} iconColor="bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" onClose={onClose}>
      {loading ? <LoadingState /> : !data ? <EmptyState message="Não foi possível carregar." /> : filtered.length === 0 ? <EmptyState message="Nenhum membro novo este mês." /> : (
        <div className="space-y-2">
          <p className="mb-3 text-xs text-slate-500">{filtered.length} membro{filtered.length !== 1 ? 's' : ''} adicionado{filtered.length !== 1 ? 's' : ''} este mês.</p>
          {filtered.map((m) => {
            const name = m.preferredName || m.fullName;
            const phone = m.mobile || m.phone;
            const waLink = whatsappLink(phone, `Olá ${name}, seja muito bem-vindo(a) à nossa família! 🎉 É uma alegria ter você conosco! 🙏`);
            const addedDate = new Date(m.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-sm font-bold text-white">
                  {m.photoUrl ? <img src={m.photoUrl} alt={name} className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {addedDate}{m.church && ` • ${m.church.name}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {phone && <a href={`tel:${phone}`} title="Ligar" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"><Phone className="h-3.5 w-3.5" /></a>}
                  {waLink && (
                    <a href={waLink} target="_blank" rel="noopener noreferrer" title="Boas-vindas pelo WhatsApp"
                      className="flex items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600">
                      <MessageCircle className="h-3 w-3" /> Parabéns
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

// ─── Calculator Modal ─────────────────────────────────────────────────────────

function CalculatorModal({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  function inputDigit(d: string) {
    if (waiting) { setDisplay(d); setWaiting(false); }
    else setDisplay(display === '0' ? d : display.length < 12 ? display + d : display);
  }

  function inputDecimal() {
    if (waiting) { setDisplay('0.'); setWaiting(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  }

  function calc(a: number, b: number, o: string): number {
    if (o === '+') return a + b;
    if (o === '-') return a - b;
    if (o === '×') return a * b;
    if (o === '÷') return b !== 0 ? a / b : 0;
    return b;
  }

  function handleOp(nextOp: string) {
    const val = parseFloat(display);
    if (prev !== null && op && !waiting) {
      const res = calc(prev, val, op);
      const resStr = String(parseFloat(res.toFixed(10)));
      setDisplay(resStr); setPrev(res);
    } else { setPrev(val); }
    setWaiting(true); setOp(nextOp);
  }

  function handleEquals() {
    if (!op || prev === null) return;
    const res = calc(prev, parseFloat(display), op);
    setDisplay(String(parseFloat(res.toFixed(10))));
    setPrev(null); setOp(null); setWaiting(true);
  }

  function clear() { setDisplay('0'); setPrev(null); setOp(null); setWaiting(false); }

  function Btn({ label, onClick, variant = 'num' }: { label: string; onClick: () => void; variant?: 'num' | 'op' | 'fn' | 'eq' }) {
    const cls = variant === 'op' ? 'bg-amber-400 text-white hover:bg-amber-300 dark:bg-amber-500'
      : variant === 'eq' ? 'bg-amber-500 text-white hover:bg-amber-400 dark:bg-amber-600'
      : variant === 'fn' ? 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-white'
      : 'bg-slate-700 text-white hover:bg-slate-600 dark:bg-slate-700';
    return (
      <button type="button" onClick={onClick}
        className={`flex h-14 items-center justify-center rounded-2xl text-lg font-semibold transition-all active:scale-95 ${cls}`}>
        {label}
      </button>
    );
  }

  return (
    <ModalShell title="Calculadora" icon={Calculator} iconColor="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-2xl bg-slate-900 px-5 py-4 text-right">
          {op && prev !== null && <p className="text-xs text-slate-500">{prev} {op}</p>}
          <p className="truncate text-4xl font-light tracking-tight text-white">{display}</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Btn label="AC" onClick={clear} variant="fn" />
          <Btn label="+/-" onClick={() => setDisplay(String(parseFloat(display) * -1))} variant="fn" />
          <Btn label="%" onClick={() => setDisplay(String(parseFloat(display) / 100))} variant="fn" />
          <Btn label="÷" onClick={() => handleOp('÷')} variant="op" />
          <Btn label="7" onClick={() => inputDigit('7')} />
          <Btn label="8" onClick={() => inputDigit('8')} />
          <Btn label="9" onClick={() => inputDigit('9')} />
          <Btn label="×" onClick={() => handleOp('×')} variant="op" />
          <Btn label="4" onClick={() => inputDigit('4')} />
          <Btn label="5" onClick={() => inputDigit('5')} />
          <Btn label="6" onClick={() => inputDigit('6')} />
          <Btn label="-" onClick={() => handleOp('-')} variant="op" />
          <Btn label="1" onClick={() => inputDigit('1')} />
          <Btn label="2" onClick={() => inputDigit('2')} />
          <Btn label="3" onClick={() => inputDigit('3')} />
          <Btn label="+" onClick={() => handleOp('+')} variant="op" />
          <div className="col-span-2"><button type="button" onClick={() => inputDigit('0')} className="flex h-14 w-full items-center justify-center rounded-2xl bg-slate-700 text-lg font-semibold text-white transition-all hover:bg-slate-600 active:scale-95">0</button></div>
          <Btn label="," onClick={inputDecimal} />
          <Btn label="=" onClick={handleEquals} variant="eq" />
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Agenda Modal ─────────────────────────────────────────────────────────────

function AgendaModal({ onClose }: { onClose: () => void }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [datesWithNotes, setDatesWithNotes] = useState<Set<string>>(new Set());
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  useEffect(() => {
    authFetch('/api/user-notes')
      .then(r => r.ok ? r.json() : [])
      .then((notes: { date: string }[]) => setDatesWithNotes(new Set(notes.map(n => n.date))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setNoteLoading(true);
    setNoteContent('');
    setSaved(false);
    setSaveError(null);
    authFetch(`/api/user-notes?date=${selectedDate}`)
      .then(r => r.ok ? r.json() : { content: '' })
      .then(d => setNoteContent(d.content || ''))
      .catch(() => {})
      .finally(() => setNoteLoading(false));
  }, [selectedDate]);

  function handleContentChange(content: string) {
    setNoteContent(content);
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveNote(content), 1500);
  }

  async function saveNote(content?: string) {
    if (!selectedDate) return;
    const body = content ?? noteContent;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch('/api/user-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ date: selectedDate, content: body }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSaved(true);
      setDatesWithNotes(prev => new Set([...prev, selectedDate]));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function prevMonth() { const d = new Date(viewYear, viewMonth - 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  function nextMonth() { const d = new Date(viewYear, viewMonth + 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  return (
    <ModalShell title="Agenda" icon={BookMarked} iconColor="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300" onClose={onClose}>
      <div className="space-y-3">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-semibold text-slate-800 dark:text-white">{MONTHS_PT[viewMonth]} {viewYear}</span>
          <button type="button" onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS_SHORT.map((d, i) => <div key={i} className="py-1 text-[10px] font-medium text-slate-400">{d}</div>)}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = toDateStr(viewYear, viewMonth, day);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const hasNote = datesWithNotes.has(dateStr);
            return (
              <button key={day} type="button" onClick={() => setSelectedDate(dateStr)}
                className={`relative flex aspect-square items-center justify-center rounded-lg text-xs font-medium transition-all ${isSelected ? 'bg-indigo-600 text-white' : isToday ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                {day}
                {hasNote && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-400" />}
              </button>
            );
          })}
        </div>

        {/* Note editor */}
        {selectedDate ? (
          <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-xs font-semibold capitalize text-slate-600 dark:text-slate-300">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {saveError && <span className="text-[10px] text-red-500">{saveError}</span>}
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                {saved && !saving && <span className="text-[10px] text-green-500">✓ Salvo</span>}
                <button type="button" onClick={() => saveNote()}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Salvar
                </button>
              </div>
            </div>
            {noteLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>
            ) : (
              <RichEditor key={selectedDate} value={noteContent} onChange={handleContentChange} placeholder="Escreva sua nota para este dia..." minHeight={100} />
            )}
          </div>
        ) : (
          <p className="py-3 text-center text-xs text-slate-400">Selecione um dia para escrever uma nota.</p>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Sticky Notes Panel (floating, persistent) ───────────────────────────────

export function StickyNotesPanel({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState<StickyNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [newColor, setNewColor] = useState(NOTE_COLORS[0].bg);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setLoading(true);
    authFetch('/api/user-sticky-notes')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => setNotes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function addNote() {
    setAddError(null);
    try {
      const r = await fetch('/api/user-sticky-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content: '', color: newColor, position: notes.length }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      const note = await r.json();
      setNotes(prev => [...prev, note]);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Erro ao criar nota');
    }
  }

  async function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id));
    await fetch(`/api/user-sticky-notes/${id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {});
  }

  function updateContent(id: string, content: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
    if (saveTimeouts.current[id]) clearTimeout(saveTimeouts.current[id]);
    saveTimeouts.current[id] = setTimeout(() => {
      fetch(`/api/user-sticky-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content }),
      }).catch(() => {});
    }, 1200);
  }

  async function changeColor(id: string, color: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, color } : n));
    await fetch(`/api/user-sticky-notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ color }),
    }).catch(() => {});
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const fromIdx = notes.findIndex(n => n.id === dragId);
    const toIdx = notes.findIndex(n => n.id === targetId);
    const reordered = [...notes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updated = reordered.map((n, i) => ({ ...n, position: i }));
    setNotes(updated);
    setDragId(null);
    setDragOverId(null);
    updated.forEach((n, i) => {
      fetch(`/api/user-sticky-notes/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ position: i }),
      }).catch(() => {});
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="fixed right-4 top-20 z-[70] flex w-80 flex-col overflow-hidden rounded-2xl border border-yellow-200 bg-white shadow-2xl dark:border-yellow-800/40 dark:bg-slate-800"
      style={{ maxHeight: 'calc(100vh - 6rem)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-yellow-100 bg-yellow-50 px-3 py-2.5 dark:border-yellow-900/30 dark:bg-yellow-900/20">
        <StickyNote className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
        <span className="flex-1 text-sm font-bold text-yellow-900 dark:text-yellow-200">Post-its</span>
        <span className="text-xs text-yellow-600 dark:text-yellow-400">{notes.length}</span>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-300 dark:hover:bg-yellow-900/40">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* New note bar */}
      <div className="flex items-center gap-2 border-b border-yellow-100 px-3 py-2 dark:border-yellow-900/30">
        <span className="text-[10px] text-slate-500">Cor:</span>
        <div className="flex gap-1">
          {NOTE_COLORS.map(c => (
            <button key={c.bg} type="button" onClick={() => setNewColor(c.bg)}
              className={`h-4 w-4 rounded-full border-2 transition-transform hover:scale-110 ${newColor === c.bg ? 'scale-125 border-slate-600' : 'border-transparent'}`}
              style={{ background: c.bg }} title={c.label} />
          ))}
        </div>
        <button type="button" onClick={addNote}
          className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 transition hover:opacity-80"
          style={{ background: newColor }}>
          <Plus className="h-3 w-3" /> Nova nota
        </button>
      </div>

      {addError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-300">
          ⚠ {addError}
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-yellow-400" /></div>
        ) : notes.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">Escolha uma cor e clique em "Nova nota".</p>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              draggable
              onDragStart={(e) => onDragStart(e, note.id)}
              onDragOver={(e) => onDragOver(e, note.id)}
              onDrop={() => onDrop(note.id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={`overflow-hidden rounded-xl shadow-sm transition-all ${dragOverId === note.id && dragId !== note.id ? 'scale-[1.02] ring-2 ring-yellow-400' : ''} ${dragId === note.id ? 'opacity-50' : ''}`}
              style={{ background: note.color }}
            >
              <div className="flex cursor-grab items-center gap-1.5 px-2.5 py-1.5 active:cursor-grabbing">
                <div className="flex gap-1">
                  {NOTE_COLORS.map(c => (
                    <button key={c.bg} type="button" onClick={() => changeColor(note.id, c.bg)}
                      className={`h-3 w-3 rounded-full border-2 transition-transform hover:scale-110 ${note.color === c.bg ? 'scale-125 border-slate-600' : 'border-transparent'}`}
                      style={{ background: c.bg }} title={c.label} />
                  ))}
                </div>
                <button type="button" onClick={() => deleteNote(note.id)} title="Excluir"
                  className="ml-auto rounded p-0.5 text-slate-500 hover:text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="px-2.5 pb-2.5" onMouseDown={e => e.stopPropagation()}>
                <RichEditor key={note.id} value={note.content} onChange={(v) => updateContent(note.id, v)} placeholder="Escreva aqui..." minHeight={60} />
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuickWidgets({ churchId, campoId, notesOpen, onToggleNotes }: QuickWidgetsProps) {
  const currentMonth = new Date().getMonth() + 1;
  const campaigns = CAMPAIGNS_BY_MONTH[currentMonth] || [];

  const [openWidget, setOpenWidget] = useState<WidgetId | null>(null);

  const [birthdays, setBirthdays] = useState<{ today: BirthdayMember[]; week: BirthdayMember[] } | null>(null);
  const [birthdaysLoading, setBirthdaysLoading] = useState(false);
  const [bibleVerse, setBibleVerse] = useState<BibleVerse | null>(null);
  const [bibleLoading, setBibleLoading] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [events, setEvents] = useState<ChurchEvent[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [newMembers, setNewMembers] = useState<NewMember[] | null>(null);
  const [newMembersLoading, setNewMembersLoading] = useState(false);

  const [todayBirthdayCount, setTodayBirthdayCount] = useState<number | null>(null);
  const [newMembersCount, setNewMembersCount] = useState<number | null>(null);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState<number | null>(null);

  useEffect(() => {
    const scopeParams = new URLSearchParams();
    if (churchId) scopeParams.set('churchId', churchId);
    else if (campoId) scopeParams.set('campoId', campoId);

    authFetch(`/api/members/birthdays?${scopeParams}&month=${currentMonth}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setTodayBirthdayCount(data.stats?.today ?? 0))
      .catch(() => {});

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const memberParams = new URLSearchParams(scopeParams);
    memberParams.set('createdFrom', startOfMonth);
    memberParams.set('pageSize', '1');
    authFetch(`/api/members?${memberParams}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setNewMembersCount(data.total ?? 0))
      .catch(() => {});

    const eventParams = new URLSearchParams();
    if (campoId) eventParams.set('campoId', campoId);
    eventParams.set('year', String(now.getFullYear()));
    authFetch(`/api/annual-events?${eventParams}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: ChurchEvent[]) => {
        if (!data) return;
        const today = now.toISOString().split('T')[0];
        setUpcomingEventsCount(data.filter(e => e.datareal >= today).length);
      })
      .catch(() => {});
  }, [churchId, campoId, currentMonth]);

  const openWidgetModal = useCallback(async (id: WidgetId) => {
    setOpenWidget(id);

    const scopeParams = new URLSearchParams();
    if (churchId) scopeParams.set('churchId', churchId);
    else if (campoId) scopeParams.set('campoId', campoId);

    if (id === 'birthdays' && !birthdays) {
      setBirthdaysLoading(true);
      try {
        const r = await authFetch(`/api/members/birthdays?${scopeParams}&month=${currentMonth}`);
        const data = r.ok ? await r.json() : null;
        const members: BirthdayMember[] = data?.members || [];
        setBirthdays({ today: members.filter(m => m.today), week: members.filter(m => !m.today && m.daysUntil <= 6) });
      } catch { /* silent */ } finally { setBirthdaysLoading(false); }
    }

    if (id === 'bible' && !bibleVerse) {
      setBibleLoading(true);
      try {
        const ref = VERSE_REFS[dayOfYear() % VERSE_REFS.length];
        const data = await fetch(`https://bible-api.com/${ref}?translation=almeida`).then(r => r.json());
        setBibleVerse({ text: data.text?.trim() || '', reference: data.reference || ref });
      } catch { /* silent */ } finally { setBibleLoading(false); }
    }

    if (id === 'holidays' && !holidays) {
      setHolidaysLoading(true);
      try {
        const year = new Date().getFullYear();
        const data = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`).then(r => r.json());
        setHolidays(Array.isArray(data) ? data : []);
      } catch { /* silent */ } finally { setHolidaysLoading(false); }
    }

    if (id === 'events' && !events) {
      setEventsLoading(true);
      try {
        const params = new URLSearchParams();
        if (campoId) params.set('campoId', campoId);
        params.set('year', String(new Date().getFullYear()));
        const r = await authFetch(`/api/annual-events?${params}`);
        const data: ChurchEvent[] = r.ok ? await r.json() : [];
        const today = new Date().toISOString().split('T')[0];
        setEvents(Array.isArray(data) ? data.filter(e => e.datareal >= today) : []);
      } catch { /* silent */ } finally { setEventsLoading(false); }
    }

    if (id === 'newMembers' && !newMembers) {
      setNewMembersLoading(true);
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const params = new URLSearchParams(scopeParams);
        params.set('createdFrom', startOfMonth);
        params.set('pageSize', '50');
        const r = await authFetch(`/api/members?${params}`);
        const data = r.ok ? await r.json() : null;
        setNewMembers(Array.isArray(data?.data) ? data.data : []);
      } catch { /* silent */ } finally { setNewMembersLoading(false); }
    }
  }, [birthdays, bibleVerse, holidays, events, newMembers, churchId, campoId, currentMonth]);

  // Widget modal container width varies per widget
  function widgetMaxWidth(id: WidgetId): string {
    if (id === 'calculator') return 'max-w-xs';
    if (id === 'notes') return 'max-w-xl';
    return 'max-w-lg';
  }

  const widgets = [
    { id: 'birthdays' as WidgetId, icon: Cake, label: 'Aniversários', badge: todayBirthdayCount, badgeColor: 'bg-rose-500', btnClass: 'bg-rose-50 ring-rose-200 hover:bg-rose-100 dark:bg-rose-900/20 dark:ring-rose-800 dark:hover:bg-rose-900/40', iconClass: 'text-rose-500' },
    { id: 'bible' as WidgetId, icon: BookOpen, label: 'Palavra do Dia', badge: null, badgeColor: '', btnClass: 'bg-amber-50 ring-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:ring-amber-800 dark:hover:bg-amber-900/40', iconClass: 'text-amber-600' },
    { id: 'campaigns' as WidgetId, icon: Heart, label: 'Campanhas', badge: campaigns.length || null, badgeColor: 'bg-green-500', btnClass: 'bg-green-50 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:ring-green-800 dark:hover:bg-green-900/40', iconClass: 'text-green-600' },
    { id: 'holidays' as WidgetId, icon: Calendar, label: 'Feriados', badge: null, badgeColor: '', btnClass: 'bg-blue-50 ring-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:ring-blue-800 dark:hover:bg-blue-900/40', iconClass: 'text-blue-600' },
    { id: 'events' as WidgetId, icon: CalendarDays, label: 'Próx. Eventos', badge: upcomingEventsCount, badgeColor: 'bg-purple-500', btnClass: 'bg-purple-50 ring-purple-200 hover:bg-purple-100 dark:bg-purple-900/20 dark:ring-purple-800 dark:hover:bg-purple-900/40', iconClass: 'text-purple-600' },
    { id: 'newMembers' as WidgetId, icon: UserPlus, label: 'Novos Membros', badge: newMembersCount, badgeColor: 'bg-sky-500', btnClass: 'bg-sky-50 ring-sky-200 hover:bg-sky-100 dark:bg-sky-900/20 dark:ring-sky-800 dark:hover:bg-sky-900/40', iconClass: 'text-sky-600' },
    { id: 'calculator' as WidgetId, icon: Calculator, label: 'Calculadora', badge: null, badgeColor: '', btnClass: 'bg-slate-50 ring-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:ring-slate-700 dark:hover:bg-slate-700', iconClass: 'text-slate-600' },
    { id: 'agenda' as WidgetId, icon: BookMarked, label: 'Agenda', badge: null, badgeColor: '', btnClass: 'bg-indigo-50 ring-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:ring-indigo-800 dark:hover:bg-indigo-900/40', iconClass: 'text-indigo-600' },
    { id: 'notes' as WidgetId, icon: StickyNote, label: 'Bloco de Notas', badge: null, badgeColor: '', btnClass: 'bg-yellow-50 ring-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:ring-yellow-800 dark:hover:bg-yellow-900/40', iconClass: 'text-yellow-600' },
  ];

  return (
    <>
      {/* Widget bar — grid 3 cols on mobile, flex row on sm+ */}
      <div className="grid grid-cols-3 gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:flex sm:flex-wrap sm:gap-2">
        {widgets.map((w) => {
          const Icon = w.icon;
          const isNotesActive = w.id === 'notes' && notesOpen;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => w.id === 'notes' ? onToggleNotes?.() : openWidgetModal(w.id)}
              className={`relative flex flex-col items-center gap-1.5 rounded-xl p-2.5 ring-1 transition-all sm:min-w-[68px] ${isNotesActive ? 'ring-2 ring-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 dark:ring-yellow-500' : w.btnClass}`}
            >
              {w.badge !== null && w.badge !== undefined && w.badge > 0 && (
                <span className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${w.badgeColor}`}>
                  {w.badge > 9 ? '9+' : w.badge}
                </span>
              )}
              <Icon className={`h-5 w-5 ${w.iconClass}`} />
              <span className="text-center text-[10px] font-medium leading-tight text-slate-600 dark:text-slate-300">{w.label}</span>
            </button>
          );
        })}
      </div>

      {/* Widget sub-modals */}
      <AnimatePresence>
        {openWidget && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40" onClick={() => setOpenWidget(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={() => setOpenWidget(null)}>
              <div
                className={`flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800 ${widgetMaxWidth(openWidget)}`}
                onClick={(e) => e.stopPropagation()}
              >
                {openWidget === 'birthdays' && <BirthdaysModal loading={birthdaysLoading} data={birthdays} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'bible' && <BibleModal loading={bibleLoading} data={bibleVerse} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'campaigns' && <CampaignsModal campaigns={campaigns} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'holidays' && <HolidaysModal loading={holidaysLoading} data={holidays} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'events' && <EventsModal loading={eventsLoading} data={events} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'newMembers' && <NewMembersModal loading={newMembersLoading} data={newMembers} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'calculator' && <CalculatorModal onClose={() => setOpenWidget(null)} />}
                {openWidget === 'agenda' && <AgendaModal onClose={() => setOpenWidget(null)} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
