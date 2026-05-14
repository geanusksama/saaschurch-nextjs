import { useEffect, useState } from 'react';
import { Users, Plus, Link as LinkIcon, X, Heart, Baby, User } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { apiBase } from '../../lib/apiBase';

export function FamilyRelationships() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMember = async () => {
      try {
        const response = await fetch(`${apiBase}/members/${id}`);
        if (!response.ok) {
          throw new Error('Membro nao encontrado.');
        }
        const data = await response.json();
        setMember(data);
        setFamilyMembers([]);
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Relacionamentos Familiares</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie vínculos familiares entre membros</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-5 h-5" />
          Adicionar Membro
        </button>
      </div>

      {/* Family Tree Visualization */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Arvore Familiar</h2>
        
        {/* Parents */}
        <div className="flex justify-center gap-8 mb-12">
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200 w-64">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-16 h-16 rounded-full border-4 border-blue-200 bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700">
                  {member?.fullName ? member.fullName.split(' ').map((item) => item[0]).slice(0, 2).join('') : '--'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{member?.fullName || 'Membro'}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Titular</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                <span>Membro desde {member?.membershipDate ? new Date(member.membershipDate).toLocaleDateString('pt-BR') : '-'}</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute top-1/2 -left-8 w-16 h-0.5 bg-pink-300"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Heart className="w-8 h-8 text-pink-500 fill-pink-200" />
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-6 border-2 border-pink-200 w-64">
              <div className="text-sm text-slate-600">Sem conjuge vinculado.</div>
            </div>
          </div>
        </div>

        {/* Connection Line */}
        <div className="flex justify-center mb-6">
          <div className="w-0.5 h-12 bg-slate-300"></div>
        </div>

        {/* Children */}
        <div className="flex justify-center gap-6">
          <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-200 w-56 text-sm text-slate-600">
            Sem filhos vinculados.
          </div>
        </div>
      </div>

      {/* Family Members List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Membros da Família</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-700">Membro</th>
                <th className="text-left p-4 font-semibold text-slate-700">Relacionamento</th>
                <th className="text-left p-4 font-semibold text-slate-700">Idade</th>
                <th className="text-left p-4 font-semibold text-slate-700">Membro Desde</th>
                <th className="text-right p-4 font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {familyMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-slate-500">
                    Nenhum vinculo familiar cadastrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 mt-6">
          Carregando membro...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mt-6">
          {error}
        </div>
      ) : null}

      {/* Add Relationship */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6 mt-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Adicionar Relacionamento</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Selecionar Membro</label>
            <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Selecione um membro...</option>
              <option>Lucas Martins</option>
              <option>Beatriz Cardoso</option>
              <option>Carlos Mendes</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Relacionamento</label>
            <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Selecione...</option>
              <option>Cônjuge</option>
              <option>Filho(a)</option>
              <option>Pai/Mãe</option>
              <option>Irmão/Irmã</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              <LinkIcon className="w-5 h-5" />
              Vincular
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
