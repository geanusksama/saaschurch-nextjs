import { useState, useEffect } from 'react';
import { UserPlus, Search, Calendar, User, Check, X, ShieldAlert, Loader2, Info } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { apiBase } from '../../lib/apiBase';
import { toast } from 'sonner';

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
  churches?: {
    name: string;
  } | null;
}

export default function QueroSerMembroRequests() {
  const token = localStorage.getItem('mrm_token');
  const navigate = useNavigate();

  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status !== 'all') params.append('status', status);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await fetch(`${apiBase}/membership-requests?${params.toString()}`, {
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

  useEffect(() => {
    fetchRequests();
  }, [search, status, dateFrom, dateTo]);

  const handleApprove = async (req: MembershipRequest) => {
    try {
      toast.loading('Processando aprovação...', { id: 'approve' });
      const res = await fetch(`${apiBase}/membership-requests/${req.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'approved' })
      });

      if (!res.ok) throw new Error('Falha ao aprovar solicitação.');
      
      toast.success('Solicitação aprovada! Redirecionando para formulário de cadastro...', { id: 'approve' });

      // Prefill candidate details for MemberRegistration
      const nameParts = req.name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || ' ';

      navigate('/app-ui/members/new', {
        state: {
          prefill: {
            firstName,
            lastName,
            phone: req.whatsapp,
            mobile: req.whatsapp,
            maritalStatus: req.is_married ? 'Casado' : 'Solteiro',
            churchId: req.church_id,
            notes: `Igrejas anteriores: ${req.past_churches || 'Nenhuma'}. Antecedente afro: ${req.afro_background ? 'Sim' : 'Não'}. Entrevista realizada em: ${new Date(req.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}`
          }
        }
      });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao aprovar.', { id: 'approve' });
    }
  };

  const handleReject = async (req: MembershipRequest) => {
    if (!confirm(`Tem certeza que deseja reprovar a solicitação de ${req.name}?`)) return;
    try {
      toast.loading('Processando reprovação...', { id: 'reject' });
      const res = await fetch(`${apiBase}/membership-requests/${req.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'rejected' })
      });

      if (!res.ok) throw new Error('Falha ao rejeitar solicitação.');
      
      toast.success('Solicitação reprovada com sucesso.', { id: 'reject' });
      fetchRequests();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao reprovar.', { id: 'reject' });
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Solicitações de Novo Membro</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie candidatos que pediram adesão via portal</p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Total de Pedidos</p>
          <p className="text-2xl font-bold text-slate-900">{requests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Pendentes</p>
          <p className="text-2xl font-bold text-amber-600">
            {requests.filter(r => r.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Aprovados</p>
          <p className="text-2xl font-bold text-green-600">
            {requests.filter(r => r.status === 'approved').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Reprovados</p>
          <p className="text-2xl font-bold text-red-600">
            {requests.filter(r => r.status === 'rejected').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar candidato por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            />
          </div>
          
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Reprovado</option>
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white"
            />
            <span className="text-slate-400 text-xs">até</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white"
            />
          </div>

          {(search || status !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(''); setStatus('all'); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-slate-500 hover:text-red-500 font-medium"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando solicitações...
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            Nenhuma solicitação de novo membro encontrada.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Candidato</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Igreja Alvo</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Igrejas Anteriores</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Entrevista</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-slate-800 uppercase">{req.name}</p>
                      <p className="text-xs text-slate-500">{req.whatsapp} · {req.is_married ? 'Casado(a)' : 'Solteiro(a)'}</p>
                      {req.afro_background && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100">
                          <ShieldAlert size={10} /> Antecedente Afro
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">
                    {req.churches?.name || 'AD Campinas - SEDE'}
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={req.past_churches}>
                    {req.past_churches || '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {new Date(req.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      req.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                      req.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {req.status === 'approved' ? 'Aprovado' :
                       req.status === 'rejected' ? 'Reprovado' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {req.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(req)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                        >
                          <Check size={13} /> Aprovar
                        </button>
                        <button
                          onClick={() => handleReject(req)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                        >
                          <X size={13} /> Reprovar
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">Concluído</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
