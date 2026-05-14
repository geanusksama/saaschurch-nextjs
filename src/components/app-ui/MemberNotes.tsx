import { useEffect, useState } from 'react';
import { StickyNote, Plus, Search, Lock } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { apiBase } from '../../lib/apiBase';

export function MemberNotes() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [notesData, setNotesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPrivate, setShowPrivate] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadMember = async () => {
      try {
        const response = await fetch(`${apiBase}/members/${id}`);
        if (!response.ok) {
          throw new Error('Membro nao encontrado.');
        }
        const data = await response.json();
        setMember(data);
        setNotesData([]);
      } catch (err) {
        setError(err.message || 'Falha ao carregar membro.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadMember();
    }
  }, [id]);

  const filteredNotes = notesData.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         note.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPrivacy = showPrivate || !note.isPrivate;
    return matchesSearch && matchesPrivacy;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <StickyNote className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link to={`/app-ui/members/${id}`} className="text-blue-600 hover:text-blue-700">
                {member?.fullName || 'Membro'}
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-600">Notas</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notas do Membro</h1>
            <p className="text-slate-600 dark:text-slate-400">Anotações e observações importantes</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors">
          <Plus className="w-5 h-5" />
          Nova Nota
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Total de Notas</p>
          <p className="text-2xl font-bold text-slate-900">{notesData.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Notas Privadas</p>
          <p className="text-2xl font-bold text-purple-600">
            {notesData.filter(n => n.isPrivate).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Este Mês</p>
          <p className="text-2xl font-bold text-blue-600">0</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Última Nota</p>
          <p className="text-2xl font-bold text-green-600">-</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar em notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button 
            onClick={() => setShowPrivate(!showPrivate)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
              showPrivate 
                ? 'bg-purple-50 border-purple-300 text-purple-700' 
                : 'bg-slate-50 border-slate-300 text-slate-600'
            }`}
          >
            <Lock className="w-5 h-5" />
            {showPrivate ? 'Mostrando Privadas' : 'Ocultar Privadas'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 mb-4">
          Carregando notas...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      ) : null}

      {/* Empty State */}
      {filteredNotes.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <StickyNote className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">Nenhuma nota encontrada</h3>
          <p className="text-slate-600 mb-6">
            {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando uma nova nota'}
          </p>
          <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            Adicionar Primeira Nota
          </button>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mt-6">
        <div className="flex items-start gap-3">
          <Lock className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-slate-900 mb-2">Sobre Notas Privadas</h3>
            <p className="text-sm text-slate-700">
              Notas marcadas como <strong>privadas</strong> só podem ser visualizadas por pastores, 
              líderes autorizados e equipe administrativa. Use para informações sensíveis ou confidenciais 
              relacionadas ao acompanhamento pastoral.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
