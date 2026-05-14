import { useEffect, useMemo, useState } from 'react';
import { Users, Search, Filter, Grid, List, Plus, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../design-system/components/Badge';

import { apiBase } from '../../lib/apiBase';

export function MembersGrid() {
  const token = localStorage.getItem('mrm_token');
  const [churches, setChurches] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedChurchId, setSelectedChurchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadChurches = async () => {
      try {
        const response = await fetch(`${apiBase}/churches`);
        if (!response.ok) {
          throw new Error('Falha ao carregar igrejas.');
        }
        const data = await response.json();
        setChurches(data);
        if (data.length && !selectedChurchId) {
          setSelectedChurchId(data[0].id);
        }
      } catch (err) {
        setError(err.message || 'Falha ao carregar igrejas.');
      }
    };

    loadChurches();
  }, []);

  useEffect(() => {
    const loadMembers = async () => {
      if (!selectedChurchId) {
        setMembers([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${apiBase}/churches/${selectedChurchId}/members`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error('Falha ao carregar membros.');
        }
        const data = await response.json();
        setMembers(data);
      } catch (err) {
        setError(err.message || 'Falha ao carregar membros.');
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [selectedChurchId, token]);

  const stats = useMemo(() => {
    const activeMembers = members.filter((member) => member.membershipStatus !== 'inativo').length;
    return {
      total: members.length,
      active: activeMembers,
      newMonth: 0,
      birthdays: 0,
    };
  }, [members]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Membros</h1>
            <p className="text-slate-600 dark:text-slate-400">Visualização em grade</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link to="/app-ui/members" className="flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            <List className="w-5 h-5" />
            Lista
          </Link>
          <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <Grid className="w-5 h-5" />
            Grade
          </button>
          <Link to="/app-ui/members/new" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-5 h-5" />
            Novo Membro
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Igreja</label>
          <select
            value={selectedChurchId}
            onChange={(event) => setSelectedChurchId(event.target.value)}
            className="min-w-[240px] px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione</option>
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.code} - {church.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar membros..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50">
          <Filter className="w-5 h-5" />
          Filtros
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Total de Membros</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Membros Ativos</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Novos Este Mês</p>
          <p className="text-2xl font-bold text-blue-600">{stats.newMonth}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Aniversariantes</p>
          <p className="text-2xl font-bold text-purple-600">{stats.birthdays}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 mb-4">
          Carregando membros...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      ) : null}

      {/* Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {members.map((member) => (
          <Link
            key={member.id}
            to={`/app-ui/members/${member.id}`}
            className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full mb-4 border-4 border-slate-100 group-hover:border-blue-100 transition-colors flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white text-2xl font-bold">
                {member.fullName?.split(' ').map((item) => item[0]).slice(0, 2).join('')}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{member.fullName}</h3>
              <Badge variant="active">{member.membershipStatus || 'visitor'}</Badge>
              
              <div className="w-full mt-4 pt-4 border-t border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-4 h-4" />
                  <span className="truncate">{member.phone || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{member.email || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{member.addressCity || '-'}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
