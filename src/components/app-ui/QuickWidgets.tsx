import { useState, useEffect, useCallback } from 'react';
import {
  Cake, BookOpen, Heart, Calendar, CalendarDays, UserPlus,
  X, MessageCircle, Loader2, MapPin, Clock, Phone, ExternalLink,
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
  membershipStatus: string | null;
  createdAt: string;
  church: { name: string } | null;
}

type WidgetId = 'birthdays' | 'bible' | 'campaigns' | 'holidays' | 'events' | 'newMembers';

export interface QuickWidgetsProps {
  churchId?: string;
  campoId?: string;
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

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr >= today;
}

function isPast(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr < today;
}

// ─── Sub-modal: ModalShell ─────────────────────────────────────────────────────

function ModalShell({ title, icon: Icon, iconColor, onClose, children }: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className={`flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
        >
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
  return (
    <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{message}</div>
  );
}

// ─── Birthdays Modal ──────────────────────────────────────────────────────────

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
              <div className="space-y-2">
                {data.today.map(m => (
                  <MemberCard key={m.id} member={m} messageTemplate={`Olá ${m.name}, feliz aniversário! 🎂 Que Deus abençoe muito a sua vida! 🙏`} highlight />
                ))}
              </div>
            </section>
          )}
          {data.week.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Esta Semana</h4>
              <div className="space-y-2">
                {data.week.map(m => (
                  <MemberCard key={m.id} member={m} messageTemplate={`Olá ${m.name}, antecipamos os votos de feliz aniversário! 🎂 Que Deus abençoe muito a sua vida! 🙏`} />
                ))}
              </div>
            </section>
          )}
          {data.today.length === 0 && data.week.length === 0 && (
            <EmptyState message="Nenhum aniversariante hoje ou esta semana." />
          )}
        </div>
      )}
    </ModalShell>
  );
}

function MemberCard({ member, messageTemplate, highlight = false }: {
  member: BirthdayMember;
  messageTemplate: string;
  highlight?: boolean;
}) {
  const waLink = whatsappLink(member.phone, messageTemplate);
  return (
    <div className={`flex items-center gap-3 rounded-xl p-3 ${highlight ? 'bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-900/20 dark:ring-rose-800' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-sm font-bold text-white overflow-hidden">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" />
        ) : (
          member.name.charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900 dark:text-white text-sm">{member.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {member.today ? `Hoje • ${member.age} anos` : `Em ${member.daysUntil} dia${member.daysUntil !== 1 ? 's' : ''} • ${member.age} anos`}
          {member.church && ` • ${member.church}`}
        </p>
      </div>
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          title="Enviar parabéns pelo WhatsApp"
          className="flex shrink-0 items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600"
        >
          <MessageCircle className="h-3 w-3" />
          Parabéns
        </a>
      )}
    </div>
  );
}

// ─── Bible Modal ──────────────────────────────────────────────────────────────

function BibleModal({ loading, data, onClose }: {
  loading: boolean;
  data: BibleVerse | null;
  onClose: () => void;
}) {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <ModalShell title="Palavra do Dia" icon={BookOpen} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" onClose={onClose}>
      {loading ? <LoadingState /> : !data ? (
        <EmptyState message="Não foi possível carregar o versículo. Verifique sua conexão." />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 capitalize dark:text-slate-400">{today}</p>
          <blockquote className="rounded-xl border-l-4 border-amber-400 bg-amber-50 px-5 py-4 dark:bg-amber-900/20">
            <p className="text-base leading-relaxed text-slate-800 dark:text-slate-100 italic">"{data.text}"</p>
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
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  return (
    <ModalShell
      title={`Campanhas de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`}
      icon={Heart}
      iconColor="bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300"
      onClose={onClose}
    >
      {campaigns.length === 0 ? (
        <EmptyState message="Nenhuma campanha este mês." />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div
              key={c.name}
              className="overflow-hidden rounded-xl"
              style={{ background: c.color }}
            >
              <div className="px-4 py-3">
                <h4 className="font-bold text-base" style={{ color: c.textColor }}>{c.name}</h4>
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

function HolidaysModal({ loading, data, onClose }: {
  loading: boolean;
  data: Holiday[] | null;
  onClose: () => void;
}) {
  const year = new Date().getFullYear();
  return (
    <ModalShell title={`Feriados Nacionais ${year}`} icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" onClose={onClose}>
      {loading ? <LoadingState /> : !data ? (
        <EmptyState message="Não foi possível carregar os feriados." />
      ) : (
        <div className="space-y-1.5">
          {data.map((h) => {
            const past = isPast(h.date);
            const upcoming = isUpcoming(h.date) && !past;
            const isToday = h.date === new Date().toISOString().split('T')[0];
            return (
              <div
                key={h.date}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                  isToday
                    ? 'bg-blue-100 ring-1 ring-blue-300 dark:bg-blue-900/40 dark:ring-blue-700'
                    : past
                    ? 'opacity-40'
                    : 'bg-slate-50 dark:bg-slate-900/50'
                }`}
              >
                <div className="w-14 shrink-0 text-center">
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{formatDate(h.date)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${past ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{h.name}</p>
                  <p className="text-xs capitalize text-slate-400">{h.type}</p>
                </div>
                {isToday && <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">Hoje</span>}
                {upcoming && !isToday && <span className="shrink-0 text-xs text-green-500">Próximo</span>}
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

// ─── Events Modal ─────────────────────────────────────────────────────────────

function EventsModal({ loading, data, onClose }: {
  loading: boolean;
  data: ChurchEvent[] | null;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Próximos Eventos" icon={CalendarDays} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300" onClose={onClose}>
      {loading ? <LoadingState /> : !data ? (
        <EmptyState message="Não foi possível carregar os eventos." />
      ) : data.length === 0 ? (
        <EmptyState message="Nenhum evento programado." />
      ) : (
        <div className="space-y-2">
          {data.slice(0, 20).map((ev) => {
            const isToday = ev.datareal.split('T')[0] === new Date().toISOString().split('T')[0];
            return (
              <div
                key={ev.id}
                className={`rounded-xl p-3 ${isToday ? 'bg-purple-50 ring-1 ring-purple-200 dark:bg-purple-900/20 dark:ring-purple-800' : 'bg-slate-50 dark:bg-slate-900/50'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-purple-600 py-1.5 text-white">
                    <span className="text-lg font-bold leading-none">{ev.dia}</span>
                    <span className="text-[10px] font-medium uppercase">{ev.mes.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{ev.evento}</p>
                    {ev.horario && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" /> {ev.horario}
                      </p>
                    )}
                    {ev.local && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3" /> {ev.local}
                      </p>
                    )}
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

function NewMembersModal({ loading, data, onClose }: {
  loading: boolean;
  data: NewMember[] | null;
  onClose: () => void;
}) {
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  return (
    <ModalShell
      title={`Novos Membros — ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`}
      icon={UserPlus}
      iconColor="bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300"
      onClose={onClose}
    >
      {loading ? <LoadingState /> : !data ? (
        <EmptyState message="Não foi possível carregar os novos membros." />
      ) : data.length === 0 ? (
        <EmptyState message="Nenhum membro novo este mês." />
      ) : (
        <div className="space-y-2">
          <p className="mb-3 text-xs text-slate-500">{data.length} membro{data.length !== 1 ? 's' : ''} adicionado{data.length !== 1 ? 's' : ''} este mês.</p>
          {data.map((m) => {
            const name = m.preferredName || m.fullName;
            const phone = m.mobile || m.phone;
            const waLink = whatsappLink(phone, `Olá ${name}, seja muito bem-vindo(a) à nossa família! 🎉 É uma alegria ter você conosco! 🙏`);
            const addedDate = new Date(m.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-sm font-bold text-white overflow-hidden">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    Adicionado em {addedDate}
                    {m.church && ` • ${m.church.name}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      title="Ligar"
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Dar boas-vindas pelo WhatsApp"
                      className="flex items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600"
                    >
                      <MessageCircle className="h-3 w-3" />
                      Parabéns
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuickWidgets({ churchId, campoId }: QuickWidgetsProps) {
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

  // Badge counts — loaded eagerly
  const [todayBirthdayCount, setTodayBirthdayCount] = useState<number | null>(null);
  const [newMembersCount, setNewMembersCount] = useState<number | null>(null);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState<number | null>(null);

  useEffect(() => {
    const scopeParams = new URLSearchParams();
    if (churchId) scopeParams.set('churchId', churchId);
    else if (campoId) scopeParams.set('campoId', campoId);

    fetch(`/api/members/birthdays?${scopeParams}&month=${currentMonth}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setTodayBirthdayCount(data.stats?.today ?? 0))
      .catch(() => {});

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const memberParams = new URLSearchParams(scopeParams);
    memberParams.set('createdFrom', startOfMonth);
    memberParams.set('pageSize', '1');
    fetch(`/api/members?${memberParams}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setNewMembersCount(data.total ?? 0))
      .catch(() => {});

    const eventParams = new URLSearchParams();
    if (campoId) eventParams.set('campoId', campoId);
    eventParams.set('year', String(now.getFullYear()));
    fetch(`/api/annual-events?${eventParams}`)
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
        const data = await fetch(`/api/members/birthdays?${scopeParams}&month=${currentMonth}`).then(r => r.json());
        const members: BirthdayMember[] = data.members || [];
        setBirthdays({ today: members.filter(m => m.today), week: members.filter(m => !m.today && m.daysUntil <= 6) });
      } catch { /* silent */ } finally {
        setBirthdaysLoading(false);
      }
    }

    if (id === 'bible' && !bibleVerse) {
      setBibleLoading(true);
      try {
        const ref = VERSE_REFS[dayOfYear() % VERSE_REFS.length];
        const data = await fetch(`https://bible-api.com/${ref}?translation=almeida`).then(r => r.json());
        setBibleVerse({ text: data.text?.trim() || '', reference: data.reference || ref });
      } catch { /* silent */ } finally {
        setBibleLoading(false);
      }
    }

    if (id === 'holidays' && !holidays) {
      setHolidaysLoading(true);
      try {
        const year = new Date().getFullYear();
        const data = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`).then(r => r.json());
        setHolidays(Array.isArray(data) ? data : []);
      } catch { /* silent */ } finally {
        setHolidaysLoading(false);
      }
    }

    if (id === 'events' && !events) {
      setEventsLoading(true);
      try {
        const params = new URLSearchParams();
        if (campoId) params.set('campoId', campoId);
        params.set('year', String(new Date().getFullYear()));
        const data: ChurchEvent[] = await fetch(`/api/annual-events?${params}`).then(r => r.json());
        const today = new Date().toISOString().split('T')[0];
        setEvents(Array.isArray(data) ? data.filter(e => e.datareal >= today) : []);
      } catch { /* silent */ } finally {
        setEventsLoading(false);
      }
    }

    if (id === 'newMembers' && !newMembers) {
      setNewMembersLoading(true);
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const params = new URLSearchParams(scopeParams);
        params.set('createdFrom', startOfMonth);
        params.set('pageSize', '50');
        const data = await fetch(`/api/members?${params}`).then(r => r.json());
        setNewMembers(Array.isArray(data.data) ? data.data : []);
      } catch { /* silent */ } finally {
        setNewMembersLoading(false);
      }
    }
  }, [birthdays, bibleVerse, holidays, events, newMembers, churchId, campoId, currentMonth]);

  const widgets = [
    {
      id: 'birthdays' as WidgetId,
      icon: Cake,
      label: 'Aniversários',
      badge: todayBirthdayCount,
      badgeColor: 'bg-rose-500',
      btnClass: 'bg-rose-50 ring-rose-200 hover:bg-rose-100 dark:bg-rose-900/20 dark:ring-rose-800 dark:hover:bg-rose-900/40',
      iconClass: 'text-rose-500',
    },
    {
      id: 'bible' as WidgetId,
      icon: BookOpen,
      label: 'Palavra do Dia',
      badge: null,
      badgeColor: '',
      btnClass: 'bg-amber-50 ring-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:ring-amber-800 dark:hover:bg-amber-900/40',
      iconClass: 'text-amber-600',
    },
    {
      id: 'campaigns' as WidgetId,
      icon: Heart,
      label: 'Campanhas',
      badge: campaigns.length || null,
      badgeColor: 'bg-green-500',
      btnClass: 'bg-green-50 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:ring-green-800 dark:hover:bg-green-900/40',
      iconClass: 'text-green-600',
    },
    {
      id: 'holidays' as WidgetId,
      icon: Calendar,
      label: 'Feriados',
      badge: null,
      badgeColor: '',
      btnClass: 'bg-blue-50 ring-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:ring-blue-800 dark:hover:bg-blue-900/40',
      iconClass: 'text-blue-600',
    },
    {
      id: 'events' as WidgetId,
      icon: CalendarDays,
      label: 'Próx. Eventos',
      badge: upcomingEventsCount,
      badgeColor: 'bg-purple-500',
      btnClass: 'bg-purple-50 ring-purple-200 hover:bg-purple-100 dark:bg-purple-900/20 dark:ring-purple-800 dark:hover:bg-purple-900/40',
      iconClass: 'text-purple-600',
    },
    {
      id: 'newMembers' as WidgetId,
      icon: UserPlus,
      label: 'Novos Membros',
      badge: newMembersCount,
      badgeColor: 'bg-sky-500',
      btnClass: 'bg-sky-50 ring-sky-200 hover:bg-sky-100 dark:bg-sky-900/20 dark:ring-sky-800 dark:hover:bg-sky-900/40',
      iconClass: 'text-sky-600',
    },
  ];

  return (
    <>
      {/* Widget bar */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 px-4 py-3 scrollbar-none dark:border-slate-700">
        {widgets.map((w) => {
          const Icon = w.icon;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => openWidgetModal(w.id)}
              className={`relative flex min-w-[68px] flex-col items-center gap-1.5 rounded-xl p-3 ring-1 transition-all ${w.btnClass}`}
            >
              {w.badge !== null && w.badge !== undefined && w.badge > 0 && (
                <span className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${w.badgeColor}`}>
                  {w.badge > 9 ? '9+' : w.badge}
                </span>
              )}
              <Icon className={`h-5 w-5 ${w.iconClass}`} />
              <span className="whitespace-nowrap text-[10px] font-medium text-slate-600 dark:text-slate-300">{w.label}</span>
            </button>
          );
        })}
      </div>

      {/* Widget sub-modals */}
      <AnimatePresence>
        {openWidget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40"
              onClick={() => setOpenWidget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="fixed inset-0 z-[61] flex items-center justify-center p-4"
              onClick={() => setOpenWidget(null)}
            >
              <div
                className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                {openWidget === 'birthdays' && <BirthdaysModal loading={birthdaysLoading} data={birthdays} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'bible' && <BibleModal loading={bibleLoading} data={bibleVerse} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'campaigns' && <CampaignsModal campaigns={campaigns} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'holidays' && <HolidaysModal loading={holidaysLoading} data={holidays} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'events' && <EventsModal loading={eventsLoading} data={events} onClose={() => setOpenWidget(null)} />}
                {openWidget === 'newMembers' && <NewMembersModal loading={newMembersLoading} data={newMembers} onClose={() => setOpenWidget(null)} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
