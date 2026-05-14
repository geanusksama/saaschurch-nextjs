import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Save, Search, Upload, X, User } from 'lucide-react';
import { useState, useRef } from 'react';
import { apiBase } from '../../lib/apiBase';

export function CellNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Image upload
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Member Lookup
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState<any>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) throw new Error('Falha ao enviar imagem');
      const data = await res.json();
      setPhotoUrl(data.url || data.path); // Depends on backend response
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSearchLeader = async (query: string) => {
    setSearchQuery(query);
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/members?query=${encodeURIComponent(query)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data || data); // Sometimes paginated data is in .data
      }
    } catch (err) {
      console.error('Error searching members:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      network: formData.get('network'),
      color: formData.get('color'),
      photo: photoUrl,
      leaderId: selectedLeader?.id || null,
      address: formData.get('address'),
      location: formData.get('location'),
      meetingDay: formData.get('meetingDay'),
      meetingTime: formData.get('meetingTime')
    };

    try {
      const token = localStorage.getItem('mrm_token');
      const response = await fetch(`${apiBase}/cell-groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Erro ao salvar o GF');
      }

      navigate('/app-ui/cells');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <Save className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo GF</h1>
            <p className="text-slate-600 dark:text-slate-400">Cadastre um novo Grupo Familiar</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-4xl">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

          {/* Top section: Avatar / Image Upload */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                {photoUrl ? (
                  <img src={photoUrl} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow border border-slate-200 text-slate-600 hover:text-purple-600 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Imagem do GF</h3>
              <p className="text-sm text-slate-500">Adicione uma foto ou logo do grupo</p>
              {uploadingImage && <p className="text-xs text-purple-600 mt-1">Enviando imagem...</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Nome do GF *
              </label>
              <input
                type="text"
                name="name"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ex: GF Alfa"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Cor
              </label>
              <input
                type="color"
                name="color"
                defaultValue="#8B5CF6"
                className="w-full h-10 px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Líder
              </label>
              {selectedLeader ? (
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedLeader.fullName}</p>
                      <p className="text-xs text-slate-500">{selectedLeader.mobile || 'Sem telefone'}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedLeader(null)} className="text-slate-400 hover:text-red-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Buscar membro..."
                    value={searchQuery}
                    onChange={(e) => handleSearchLeader(e.target.value)}
                  />
                  {searchQuery && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {searching ? (
                        <div className="p-3 text-sm text-slate-500 text-center">Buscando...</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              setSelectedLeader(member);
                              setSearchQuery('');
                              setSearchResults([]);
                            }}
                            className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          >
                            <User className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{member.fullName}</p>
                              <p className="text-xs text-slate-500">{member.email || member.mobile}</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-slate-500 text-center">Nenhum membro encontrado.</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Rede
              </label>
              <select name="network" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="Jovens">Jovens</option>
                <option value="Adultos">Adultos</option>
                <option value="Casais">Casais</option>
                <option value="Kids">Kids</option>
                <option value="Mulheres">Mulheres</option>
                <option value="Homens">Homens</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Endereço *
              </label>
              <input
                type="text"
                name="address"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Rua, número"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Localização (Bairro)
              </label>
              <input
                type="text"
                name="location"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ex: Jardim Paulista"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Dia da Semana *
              </label>
              <select name="meetingDay" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="Segunda">Segunda</option>
                <option value="Terça">Terça</option>
                <option value="Quarta">Quarta</option>
                <option value="Quinta">Quinta</option>
                <option value="Sexta">Sexta</option>
                <option value="Sábado">Sábado</option>
                <option value="Domingo">Domingo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Horário *
              </label>
              <input
                type="time"
                name="meetingTime"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Link
              to="/app-ui/cells"
              className="px-6 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Salvando...' : 'Salvar GF'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
