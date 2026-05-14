import { Building2, Cake, ChevronLeft, ChevronRight, ExternalLink, Gift, Loader2, Mail, MessageSquare, Phone, Printer, Search, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { apiBase } from '../../lib/apiBase';

interface BirthdayMember {
  id: string;
  name: string;
  fullName: string;
  day: number;
  month: number;
  age: number;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  church: string | null;
  membershipStatus: string | null;
  daysUntil: number;
  today: boolean;
}

type StatusFilter = 'ALL' | 'ATIVO' | 'INATIVO' | 'AGUARDANDO';

function normalizeStatus(s: string | null | undefined): string {
  const v = (s || '').toUpperCase().trim();
  // null/empty → assume ATIVO (backwards-compatible before server restart)
  return v || 'ATIVO';
}

type CampoOption = { id: string; name: string; code?: string | null };
type ChurchOption = { id: string; name: string; code?: string | null; regional?: { campoId?: string } };

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

interface BirthdayStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  nextMonth: number;
}

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function Birthdays() {
  const storedUser = readStoredUser();
  const profileType: string = storedUser.profileType || 'church';
  const isChurchProfile = profileType === 'church';
  const canChooseCampo = profileType === 'master' || profileType === 'admin';
  const showChurchFilter = !isChurchProfile;

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [members, setMembers] = useState<BirthdayMember[]>([]);
  const [stats, setStats] = useState<BirthdayStats>({ today: 0, thisWeek: 0, thisMonth: 0, nextMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ATIVO');
  const [hideOver100, setHideOver100] = useState(true);

  // Campo + church filter state (hidden for church-profile users)
  const [selectedCampoId, setSelectedCampoId] = useState<string>(
    canChooseCampo
      ? (localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '')
      : (storedUser.campoId || '')
  );
  const [selectedChurchId, setSelectedChurchId] = useState<string>('');
  const [campos, setCampos] = useState<CampoOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);

  // Load campos and churches for non-church profiles
  useEffect(() => {
    if (isChurchProfile) return;
    const token = localStorage.getItem('mrm_token');
    if (!token) return;
    setLoadingFilters(true);
    const headers = { Authorization: `Bearer ${token}` };
    const fieldParam = selectedCampoId ? `?fieldId=${encodeURIComponent(selectedCampoId)}` : '';
    Promise.all([
      canChooseCampo ? fetch(`${apiBase}/campos`, { headers }) : Promise.resolve(null),
      fetch(`${apiBase}/churches${fieldParam}`, { headers }),
    ])
      .then(async ([camposRes, churchesRes]) => {
        if (canChooseCampo && camposRes?.ok) {
          const data = await camposRes.json();
          setCampos(Array.isArray(data) ? data : []);
        }
        if (churchesRes?.ok) {
          const data = await churchesRes.json();
          setChurches(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFilters(false));
  }, [selectedCampoId]);

  const filteredChurches = useMemo(() => {
    if (!selectedCampoId) return churches;
    return churches.filter((c) => c.regional?.campoId === selectedCampoId);
  }, [churches, selectedCampoId]);

  useEffect(() => {
    const token = localStorage.getItem('mrm_token');
    if (!token) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ month: String(selectedMonth) });
    if (selectedChurchId) {
      params.set('churchId', selectedChurchId);
    } else if (selectedCampoId) {
      params.set('campoId', selectedCampoId);
    }
    // For church-profile, server auto-scopes via requireAuth

    fetch(`${apiBase}/members/birthdays?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Erro ao carregar aniversariantes');
        return res.json();
      })
      .then((data) => {
        setStats(data.stats);
        setMembers(data.members);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedMonth, selectedCampoId, selectedChurchId]);

  const filtered = members.filter((m) => {
    if (hideOver100 && m.age >= 100) return false;
    if (statusFilter !== 'ALL') {
      const st = normalizeStatus(m.membershipStatus);
      if (st !== statusFilter) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.fullName.toLowerCase().includes(q) ||
      (m.church || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleMonthChange(month: number) {
    setSelectedMonth(month);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(v: StatusFilter) {
    setStatusFilter(v);
    setPage(1);
  }

  function handleCampoChange(campoId: string) {
    setSelectedCampoId(campoId);
    setSelectedChurchId('');
    setPage(1);
  }

  function handleChurchChange(churchId: string) {
    setSelectedChurchId(churchId);
    setPage(1);
  }

  function handlePrint() {
    const monthName = months[selectedMonth - 1];
    const printDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const rows = filtered.map((m) => `
      <tr>
        <td class="day">${m.day}/${monthName.slice(0,3)}</td>
        <td class="name">${m.fullName || m.name}</td>
        <td>${m.age} anos</td>
        <td>${m.phone || '—'}</td>
        <td>${m.email || '—'}</td>
        <td>${m.church || '—'}</td>
      </tr>
    `).join('');

    const printFrame = document.createElement('iframe');
    printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(printFrame);
    const frameWindow = printFrame.contentWindow!;
    frameWindow.document.open();
    frameWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Aniversariantes – ${monthName}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 10px; color: #111; margin: 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
            .print-title { font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 3px; }
            .print-meta { font-size: 9px; color: #555; }
            .print-brand { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 6px; }
            th, td { border: 0.5px solid #dde1e7; padding: 3px 5px; text-align: left; vertical-align: middle; }
            th { background: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 8px; letter-spacing: 0.08em; }
            tr:nth-child(even) td { background: #f9fafb; }
            td.day { white-space: nowrap; font-weight: 600; }
            td.name { font-weight: 600; }
            .print-count { font-size: 9px; color: #666; margin-top: 8px; }
            @page { size: A4 portrait; margin: 10mm; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <div>
              <p class="print-title">Aniversariantes – ${monthName}</p>
              <p class="print-meta">Impresso em: ${printDate}${selectedChurchId ? ` · Igreja: ${filteredChurches.find(c => c.id === selectedChurchId)?.name || ''}` : selectedCampoId ? ` · Campo: ${campos.find(c => c.id === selectedCampoId)?.name || ''}` : ''}${search ? ` · Busca: "${search}"` : ''}</p>
            </div>
            <div class="print-brand">SISTEMA MRM</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome</th>
                <th>Idade</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Igreja</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="print-count">Total: ${filtered.length} aniversariante${filtered.length !== 1 ? 's' : ''}</p>
        </body>
      </html>
    `);
    frameWindow.document.close();
    const cleanup = () => {
      if (document.body.contains(printFrame)) printFrame.remove();
    };
    window.addEventListener('focus', cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
  }

  const handleWhatsApp = (member: BirthdayMember) => {
    const phone = (member.phone || '').replace(/\D/g, '');
    if (!phone) return;
    const msg = encodeURIComponent(`Olá ${member.name}! Feliz aniversário! 🎂🎉`);
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
  };

  const handleEmail = (member: BirthdayMember) => {
    if (!member.email) return;
    window.location.href = `mailto:${member.email}?subject=Feliz%20Aniversário!&body=Olá ${member.name}!%0A%0AFeliz Aniversário!%0A%0ATudo de bom para você neste dia especial.`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
            <Cake className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Aniversariantes</h1>
            <p className="text-slate-600 dark:text-slate-400">Celebre os aniversários dos membros</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors no-print">
            <Printer className="w-5 h-5" />
            Imprimir
          </button>
          <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors no-print">
            <Mail className="w-5 h-5" />
            Enviar Email em Massa
          </button>
          <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors no-print">
            <MessageSquare className="w-5 h-5" />
            Enviar WhatsApp
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Hoje</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.today}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Esta Semana</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.thisWeek}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Este Mês</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.thisMonth}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Próximo Mês</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.nextMonth}</p>
        </div>
      </div>

      {/* Campo / Igreja filters (hidden for church-profile users) */}
      {showChurchFilter && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4 no-print">
          <div className="flex flex-wrap gap-4">
            {canChooseCampo && (
              <div className="flex-1 min-w-[220px]">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Campo Regional</label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={selectedCampoId}
                    onChange={(e) => handleCampoChange(e.target.value)}
                    disabled={loadingFilters}
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">Todos os campos</option>
                    {campos.map((c) => (
                      <option key={c.id} value={c.id}>{c.code ? `${c.code} – ` : ''}{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Igreja</label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={selectedChurchId}
                  onChange={(e) => handleChurchChange(e.target.value)}
                  disabled={loadingFilters}
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Todas as igrejas</option>
                  {filteredChurches.map((c) => (
                    <option key={c.id} value={c.id}>{c.code ? `${c.code} – ` : ''}{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Month Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {months.map((month, index) => (
            <button
              key={month}
              onClick={() => handleMonthChange(index + 1)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedMonth === index + 1
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {month}
            </button>
          ))}
        </div>
      </div>

      {/* Search + quick filters */}
      <div className="flex flex-wrap gap-3 mb-4 no-print">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou igreja..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="ATIVO">Situação: Ativo</option>
          <option value="INATIVO">Situação: Inativo</option>
          <option value="AGUARDANDO">Situação: Aguardando</option>
          <option value="ALL">Todas as situações</option>
        </select>
        <button
          onClick={() => { setHideOver100((v) => !v); setPage(1); }}
          title={hideOver100 ? 'Exibindo apenas menores de 100 anos' : 'Exibindo todos'}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            hideOver100
              ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              : 'border-slate-200 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <User className="w-4 h-4" />
          {hideOver100 ? '< 100 anos ✓' : 'Todos os idades'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Carregando aniversariantes...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-4">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Cake className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            {search ? 'Nenhum aniversariante encontrado.' : `Nenhum aniversariante em ${months[selectedMonth - 1]}.`}
          </p>
        </div>
      )}

      {/* Birthdays List */}
      {!loading && filtered.length > 0 && (
        <>
          {/* Pagination info */}
          <div className="flex items-center justify-between mb-3 no-print">
            <p className="text-sm text-slate-500">
              Exibindo {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length} aniversariante{filtered.length !== 1 ? 's' : ''}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`e${i}`} className="px-1 text-slate-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-medium transition ${
                          safePage === p
                            ? 'border-purple-500 bg-purple-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {paginated.map((birthday) => (
            <div
              key={birthday.id}
              className={`rounded-xl border p-6 transition-all ${
                birthday.today
                  ? 'border-pink-300 bg-pink-50/50 dark:bg-pink-950/20 dark:border-pink-700'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-6">
                {/* Date Badge */}
                <div
                  className={`w-20 h-20 flex-shrink-0 rounded-xl flex flex-col items-center justify-center ${
                    birthday.today
                      ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                  }`}
                >
                  <p className="text-2xl font-bold">{birthday.day}</p>
                  <p className="text-sm">{months[birthday.month - 1].slice(0, 3)}</p>
                </div>

                {/* Avatar */}
                <div className="flex-shrink-0">
                  {birthday.photoUrl ? (
                    <img
                      src={birthday.photoUrl}
                      alt={birthday.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg">
                      {birthday.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{birthday.name}</h3>
                    {birthday.today && (
                      <span className="px-3 py-1 bg-pink-500 text-white rounded-full text-xs font-bold flex items-center gap-1">
                        <Cake className="w-3 h-3" />
                        HOJE!
                      </span>
                    )}
                    {!birthday.today && birthday.daysUntil <= 7 && (
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded-full text-xs font-medium">
                        Em {birthday.daysUntil} dia{birthday.daysUntil !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {birthday.age} anos
                    </span>
                    {birthday.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {birthday.phone}
                      </span>
                    )}
                    {birthday.email && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{birthday.email}</span>
                      </span>
                    )}
                    {birthday.church && (
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 rounded text-xs">
                        {birthday.church}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <Link
                    to={`/app-ui/members/${birthday.id}`}
                    title="Ver perfil do membro"
                    className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </Link>
                  {birthday.email && (
                    <button
                      onClick={() => handleEmail(birthday)}
                      title="Enviar email"
                      className="p-3 bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-950/50 transition-colors"
                    >
                      <Mail className="w-5 h-5" />
                    </button>
                  )}
                  {birthday.phone && (
                    <button
                      onClick={() => handleWhatsApp(birthday)}
                      title="Enviar WhatsApp"
                      className="p-3 bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-950/50 transition-colors"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    title="Dar presente"
                    className="p-3 bg-pink-100 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 rounded-lg hover:bg-pink-200 dark:hover:bg-pink-950/50 transition-colors"
                  >
                    <Gift className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

          {/* Bottom pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 no-print">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600">Página {safePage} de {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
