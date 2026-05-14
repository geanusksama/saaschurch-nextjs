import { useEffect, useState } from 'react';
import { FileText, Upload, Download, Eye, Trash2, FileCheck } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { apiBase } from '../../lib/apiBase';

export function MemberDocuments() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [documents, setDocuments] = useState([]);
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
        setDocuments([]);
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
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link to={`/app-ui/members/${id}`} className="text-blue-600 hover:text-blue-700">
                {member?.fullName || 'Membro'}
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-600">Documentos</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Documentos do Membro</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie documentos e arquivos</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Upload className="w-5 h-5" />
          Upload Documento
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Total de Documentos</p>
          <p className="text-2xl font-bold text-slate-900">{documents.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Espaço Utilizado</p>
          <p className="text-2xl font-bold text-blue-600">0 MB</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Último Upload</p>
          <p className="text-2xl font-bold text-green-600">-</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Pendentes</p>
          <p className="text-2xl font-bold text-orange-600">0</p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-dashed border-blue-300 p-12 mb-6 text-center cursor-pointer hover:border-blue-400 transition-colors">
        <Upload className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">Arraste arquivos para fazer upload</h3>
        <p className="text-slate-600 mb-4">ou clique para selecionar do seu computador</p>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
          Selecionar Arquivos
        </button>
        <p className="text-sm text-slate-500 mt-4">Formatos aceitos: PDF, JPG, PNG, DOCX (máx. 10MB)</p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 mb-4">
          Carregando documentos...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      ) : null}

      {/* Documents Grid */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Documentos</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-700">Documento</th>
                <th className="text-left p-4 font-semibold text-slate-700">Tipo</th>
                <th className="text-left p-4 font-semibold text-slate-700">Tamanho</th>
                <th className="text-left p-4 font-semibold text-slate-700">Upload</th>
                <th className="text-left p-4 font-semibold text-slate-700">Por</th>
                <th className="text-right p-4 font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-slate-500">
                    Nenhum documento enviado ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Requirements */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Documentos Obrigatorios</h2>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <FileCheck className="w-5 h-5 text-green-600" />
          Sem requisitos configurados ainda.
        </div>
      </div>
    </div>
  );
}
