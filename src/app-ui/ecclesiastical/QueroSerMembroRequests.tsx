import { useState } from 'react';
import { UserPlus, Search, Calendar, User, Check, X, ShieldAlert, Loader2, Info, FileCheck2, FileClock, Eye, SlidersHorizontal, FilterX } from 'lucide-react';
import { MembershipReviewModal, type MembershipRequestFull } from './MembershipReviewModal';
import { Link, useNavigate } from 'react-router';
import { apiBase } from '../../lib/apiBase';
import { usePermissions } from '../../lib/usePermissions';
import { toast } from 'sonner';
import { AvisoDefinaFiltros } from '../../components/app-ui/BotaoBuscar';

interface MembershipRequest {
  id: string;
  name: string;
  whatsapp: string;
  is_married: boolean;
  past_churches: string;
  afro_background: boolean;
  scheduled_date: string;
  status: 'pending' | 'approved' | 'rejected';
  church_id: string;
  created_at: string;
  // ficha de adesão (link enviado por WhatsApp ao pedir "Quero ser Membro")
  form_token?: string | null;
  form_submitted_at?: string | null;
  form_data?: Record<string, string> | null;
  documents?: Array<{ tipo: string; url: string; nome: string }> | null;
  review_notes?: string | null;
  member_rol?: number | null;
  churches?: {
    name: string;
  } | null;
  // igreja escolhida pela pessoa: quem avalia é a sede do campo dela, mas é
  // aqui que o membro é cadastrado quando a sede aprova
  desired_church_id?: string | null;
  desired_church_name?: string | null;
}

export default function QueroSerMembroRequests() {
  const token = localStorage.getItem('mrm_token');
  const navigate = useNavigate();

  /**
   * A tela tem chave própria na matriz (`membership_requests`) — antes dividia
   * a de `members`, então não dava para liberar a lista sem liberar o cadastro
   * inteiro. `edit` é o que autoriza decidir a ficha: sem ele a pessoa
   * acompanha os pedidos, mas não aprova nem reprova.
   */
  const perfilAtual = (): string => {
    try { return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType || 'church'; }
    catch { return 'church'; }
  };
  const { canEdit } = usePermissions(perfilAtual());
  const podeDecidir = canEdit('membership_requests');

  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [loading, setLoading] = useState(false);
  // A tela abre vazia: só consulta ao clicar em Buscar, com os filtros
  // daquele momento. Aprovar/reprovar recarrega com os filtros da última busca.
  const [filtrosAplicados, setFiltrosAplicados] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [formStatus, setFormStatus] = useState('all');
  // ficha aberta para avaliação documental
  const [reviewing, setReviewing] = useState<MembershipRequestFull | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });

  const fetchRequests = async (filtros: string | null = filtrosAplicados) => {
    if (filtros === null) return;
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/membership-requests?${filtros}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao buscar solicitações');
      const data = await res.json();
      setRequests(data);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  };

  const buscar = () => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status !== 'all') params.append('status', status);
    if (formStatus !== 'all') params.append('formStatus', formStatus);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    const filtros = params.toString();
    setFiltrosAplicados(filtros);
    void fetchRequests(filtros);
  };

  const limparFiltros = () => {
    setSearch('');
    setStatus('all');
    setFormStatus('all');
    setDateFrom('');
    setDateTo('');
  };

  const temFiltroAtivo = status !== 'all' || formStatus !== 'all' || search.trim() !== '';
  const qtdFiltrosAvancados = [status !== 'all', formStatus !== 'all', Boolean(dateFrom || dateTo)].filter(Boolean).length;

  return (
    <div className="flex min-h-full flex-col bg-[#f4f6f8] text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">
      {/* Header Compacto (Padrão Guia v2) */}
      <header className="flex items-center justify-between border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 md:py-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <UserPlus className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-[.06em] text-slate-400">Secretaria</span>
            <h1 className="text-lg font-bold tracking-[-.01em] text-slate-900 dark:text-white">Quero ser Membro</h1>
          </div>
        </div>
      </header>

      <div className="box-border flex w-full flex-1 flex-col gap-3 px-3 pb-8 pt-3 md:px-7 md:pt-4">
        {/* Barra Única: Busca + Filtros + Botão Buscar + Indicadores Compactos */}
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex min-w-0 flex-[1_1_380px] gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <input
                type="text"
                placeholder="Buscar candidato por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
                className="h-full min-h-[52px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-12 pr-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:shadow-[0_0_0_4px_rgba(15,23,42,.08)] dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltrosAbertos(true)}
              title="Filtros"
              className={`flex min-h-[52px] flex-none items-center gap-2 rounded-2xl border-[1.5px] bg-white px-4 text-sm font-semibold text-slate-900 hover:border-slate-900 md:px-5 dark:bg-slate-800 dark:text-white ${
                qtdFiltrosAvancados > 0 ? 'border-slate-900 dark:border-slate-300' : 'border-slate-200 dark:border-slate-600'
              }`}
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
              <span className="hidden md:inline">Filtros</span>
              {qtdFiltrosAvancados > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">
                  {qtdFiltrosAvancados}
                </span>
              )}
            </button>
            {temFiltroAtivo && (
              <button
                type="button"
                onClick={limparFiltros}
                title="Limpar filtros"
                className="grid min-h-[52px] w-[52px] flex-none place-items-center rounded-2xl border-[1.5px] border-slate-200 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                <FilterX className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={buscar}
              disabled={loading}
              title="Buscar"
              className="flex min-h-[52px] flex-none items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:px-6 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />}
              <span className="hidden md:inline">Buscar</span>
            </button>
          </div>

          {/* Indicadores compactos inline (mesma linha da busca) */}
          <div className="flex min-w-0 flex-[1_1_auto] gap-2 overflow-x-auto">
            <div className="flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] border-[#e8ecf1] bg-white py-2 pl-2 pr-3.5 dark:border-slate-700 dark:bg-slate-800">
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                <User className="h-[19px] w-[19px]" strokeWidth={1.8} />
              </span>
              <span className="flex flex-col">
                <span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em]">{filtrosAplicados !== null ? requests.length : '—'}</span>
                <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">Total</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => { setStatus('pending'); }}
              title="Filtrar Pendentes"
              className={`flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] bg-white py-2 pl-2 pr-3.5 text-left transition-colors hover:border-slate-900 dark:bg-slate-800 ${
                status === 'pending' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-[#e8ecf1] dark:border-slate-700'
              }`}
            >
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <FileClock className="h-[19px] w-[19px]" strokeWidth={1.8} />
              </span>
              <span className="flex flex-col">
                <span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em] text-amber-600">{filtrosAplicados !== null ? requests.filter(r => r.status === 'pending').length : '—'}</span>
                <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">Pendentes</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setStatus('approved'); }}
              title="Filtrar Aprovados"
              className={`flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] bg-white py-2 pl-2 pr-3.5 text-left transition-colors hover:border-slate-900 dark:bg-slate-800 ${
                status === 'approved' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-[#e8ecf1] dark:border-slate-700'
              }`}
            >
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Check className="h-[19px] w-[19px]" strokeWidth={1.8} />
              </span>
              <span className="flex flex-col">
                <span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em] text-emerald-600">{filtrosAplicados !== null ? requests.filter(r => r.status === 'approved').length : '—'}</span>
                <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">Aprovados</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setStatus('rejected'); }}
              title="Filtrar Reprovados"
              className={`flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] bg-white py-2 pl-2 pr-3.5 text-left transition-colors hover:border-slate-900 dark:bg-slate-800 ${
                status === 'rejected' ? 'border-rose-500 ring-1 ring-rose-500' : 'border-[#e8ecf1] dark:border-slate-700'
              }`}
            >
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                <X className="h-[19px] w-[19px]" strokeWidth={1.8} />
              </span>
              <span className="flex flex-col">
                <span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em] text-rose-600">{filtrosAplicados !== null ? requests.filter(r => r.status === 'rejected').length : '—'}</span>
                <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">Reprovados</span>
              </span>
            </button>
          </div>
        </div>

        {/* Tabela de Dados: Protagonista, ocupa o resto da tela */}
        <div className="flex-1 overflow-hidden rounded-[20px] border border-[#e8ecf1] bg-white dark:border-slate-700 dark:bg-slate-800">
          {filtrosAplicados === null && !loading ? (
            <AvisoDefinaFiltros />
          ) : loading ? (
            <div className="flex items-center justify-center py-24 text-sm text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando solicitações...
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-24 text-sm text-slate-400">
              Nenhuma solicitação de novo membro encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#eef2f6] bg-[#f8fafc] dark:border-slate-700 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[.06em] text-slate-500">Candidato</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[.06em] text-slate-500">Avalia / Destino</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[.06em] text-slate-500">Igrejas Anteriores</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[.06em] text-slate-500">Entrevista</th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[.06em] text-slate-500">Status</th>
                    <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[.06em] text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] dark:divide-slate-700">
                  {requests.map((req) => (
                    <tr key={req.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="text-[15px] font-bold text-slate-900 uppercase dark:text-white">{req.name}</p>
                          <p className="text-xs text-slate-500">{req.whatsapp} · {req.is_married ? 'Casado(a)' : 'Solteiro(a)'}</p>
                          {req.afro_background && (
                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                              <ShieldAlert size={10} /> Antecedente Afro
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium dark:text-slate-300">
                        {req.churches?.name || 'AD Campinas - SEDE'}
                        {req.desired_church_name && req.desired_church_name !== req.churches?.name && (
                          <p className="mt-0.5 text-[11px] font-normal text-amber-700 dark:text-amber-400">
                            → vira membro em <strong>{req.desired_church_name}</strong>
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={req.past_churches}>
                        {req.past_churches || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(req.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="mb-1">
                          {req.form_submitted_at ? (
                            <button
                              onClick={() => setReviewing(req as MembershipRequestFull)}
                              title="Ficha preenchida — clique para avaliar"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <FileCheck2 size={11} />
                              FICHA ENVIADA
                            </button>
                          ) : (
                            <span
                              title="A pessoa ainda não preencheu a ficha"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-700 dark:text-slate-400"
                            >
                              <FileClock size={11} /> AGUARDANDO FICHA
                            </span>
                          )}
                        </div>
                        <span className={`inline-flex h-[24px] items-center px-2.5 rounded-full text-xs font-bold ${
                          req.status === 'approved' ? 'bg-[#dcfce7] text-[#166534]' :
                          req.status === 'rejected' ? 'bg-[#fee2e2] text-[#b91c1c]' :
                          'bg-[#fef3c7] text-[#a16207]'
                        }`}>
                          {req.status === 'approved' ? 'Aprovado' :
                           req.status === 'rejected' ? 'Reprovado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setReviewing(req as MembershipRequestFull)}
                          className={`inline-flex h-9 items-center gap-1.5 px-3 rounded-[10px] text-xs font-semibold transition-colors ${
                            req.status === 'pending'
                              ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900'
                              : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <Eye size={13} />
                          {req.status === 'pending' ? 'Avaliar ficha' : 'Ver ficha'}
                        </button>
                        {req.status === 'approved' && req.member_rol && (
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">
                            ROL {req.member_rol}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Gaveta Lateral de Filtros Avançados (Drawer Guia v2) */}
      {filtrosAbertos && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setFiltrosAbertos(false)} />
          <aside className="relative flex h-full w-[min(440px,100%)] flex-col bg-white shadow-[-20px_0_50px_-20px_rgba(15,23,42,.35)] dark:bg-slate-800">
            <div className="flex items-center gap-3.5 border-b border-[#eef2f6] px-5 py-4 dark:border-slate-700">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <SlidersHorizontal className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="flex flex-1 flex-col">
                <span className="text-base font-bold text-slate-900 dark:text-white">Filtros</span>
                <span className="text-xs text-slate-500">Refine as solicitações de adesão</span>
              </div>
              <button
                type="button"
                onClick={() => setFiltrosAbertos(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300">Status da Solicitação</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-[46px] px-3.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">Todos os Status</option>
                  <option value="pending">Pendente</option>
                  <option value="approved">Aprovado</option>
                  <option value="rejected">Reprovado</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300">Situação da Ficha</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full h-[46px] px-3.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">Toda a documentação</option>
                  <option value="submitted">Documentos enviados</option>
                  <option value="awaiting">Aguardando documentos</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300">Período de Solicitação</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-500 mb-1 block">De</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full h-[46px] px-3 rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 mb-1 block">Até</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full h-[46px] px-3 rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-[#eef2f6] p-4 dark:border-slate-700">
              <button
                type="button"
                onClick={limparFiltros}
                className="h-10 flex-1 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => { setFiltrosAbertos(false); buscar(); }}
                className="h-10 flex-1 rounded-[10px] bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Aplicar Filtros
              </button>
            </div>
          </aside>
        </div>
      )}

      {reviewing && (
        <MembershipReviewModal
          request={reviewing}
          podeDecidir={podeDecidir}
          onClose={() => setReviewing(null)}
          onDone={() => fetchRequests()}
        />
      )}
    </div>
  );
}
