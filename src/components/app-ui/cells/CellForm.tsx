/**
 * Formulário do GF — compartilhado pelo cadastro e pela edição.
 *
 * O endereço é estruturado (e não texto livre) porque o LocationPicker precisa
 * de campos separados para gravar as coordenadas, e a distância até o membro
 * depende delas.
 */

import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Loader2, Save, Search, Upload, User, X } from 'lucide-react';
import { apiBase } from '../../../lib/apiBase';
import { formatZipcode, lookupZipcode, normalizeZipcode } from '../../../lib/geo';
import { LocationPicker } from '../shared/LocationPicker';

interface MemberOption {
  id: string;
  fullName: string;
  email?: string | null;
  mobile?: string | null;
  phone?: string | null;
}

export interface CellFormValues {
  name: string;
  network: string;
  color: string;
  photo: string;
  leaderId: string | null;
  leaderName: string;
  leaderPhone: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZipcode: string;
  latitude: string;
  longitude: string;
  meetingDay: string;
  meetingTime: string;
}

export const EMPTY_CELL_FORM: CellFormValues = {
  name: '',
  network: 'Adultos',
  color: '#8B5CF6',
  photo: '',
  leaderId: null,
  leaderName: '',
  leaderPhone: '',
  addressStreet: '',
  addressNumber: '',
  addressComplement: '',
  addressNeighborhood: '',
  addressCity: '',
  addressState: '',
  addressZipcode: '',
  latitude: '',
  longitude: '',
  meetingDay: 'Quinta',
  meetingTime: '',
};

const NETWORKS = ['Jovens', 'Adultos', 'Casais', 'Kids', 'Mulheres', 'Homens'];
const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const inputClass =
  'w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500';
const labelClass = 'block text-sm font-semibold text-slate-900 mb-2';

interface CellFormProps {
  values: CellFormValues;
  onChange: (next: CellFormValues) => void;
  onSubmit: () => void;
  saving: boolean;
  error: string;
  submitLabel: string;
  /** Quando presente, Cancelar fecha o modal em vez de navegar para a lista. */
  onCancel?: () => void;
}

export function CellForm({ values, onChange, onSubmit, saving, error, submitLabel, onCancel }: CellFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState('');

  function set(patch: Partial<CellFormValues>) {
    onChange({ ...values, ...patch });
  }

  function authHeaders(): HeadersInit {
    const token = localStorage.getItem('mrm_token') ?? '';
    return { Authorization: `Bearer ${token}` };
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(`${apiBase}/upload`, { method: 'POST', headers: authHeaders(), body });
      if (!res.ok) throw new Error('Falha ao enviar imagem');
      const data = await res.json();
      set({ photo: data.url || data.path || '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao enviar imagem');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSearchLeader(query: string) {
    setSearchQuery(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${apiBase}/members?query=${encodeURIComponent(query)}&limit=10`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data || data || []);
      }
    } catch (err) {
      console.error('[CellForm] busca de líder', err);
    } finally {
      setSearching(false);
    }
  }

  async function handleZipLookup() {
    setZipError('');
    setZipLoading(true);
    try {
      const found = await lookupZipcode(values.addressZipcode);
      set({
        addressZipcode: found.addressZipcode,
        addressStreet: found.addressStreet || values.addressStreet,
        addressNeighborhood: found.addressNeighborhood || values.addressNeighborhood,
        addressCity: found.addressCity || values.addressCity,
        addressState: found.addressState || values.addressState,
      });
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Falha ao consultar o CEP');
    } finally {
      setZipLoading(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

      <div className="flex items-center gap-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
            {values.photo ? (
              <img src={values.photo} alt="Capa" className="w-full h-full object-cover" />
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
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Imagem do GF</h3>
          <p className="text-sm text-slate-500">Adicione uma foto ou logo do grupo</p>
          {uploadingImage && <p className="text-xs text-purple-600 mt-1">Enviando imagem...</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <label className={labelClass}>Nome do GF *</label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => set({ name: e.target.value })}
            className={inputClass}
            placeholder="Ex: GF Alfa"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Cor</label>
          <input
            type="color"
            value={values.color}
            onChange={(e) => set({ color: e.target.value })}
            className="w-full h-10 px-2 py-1 border border-slate-200 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>Líder</label>
          {values.leaderId ? (
            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{values.leaderName}</p>
                  <p className="text-xs text-slate-500">{values.leaderPhone || 'Sem telefone'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => set({ leaderId: null, leaderName: '', leaderPhone: '' })}
                className="text-slate-400 hover:text-red-500"
              >
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
                className={`${inputClass} pl-10`}
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
                          set({
                            leaderId: member.id,
                            leaderName: member.fullName,
                            leaderPhone: member.mobile || member.phone || '',
                          });
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
          <label className={labelClass}>Rede</label>
          <select value={values.network} onChange={(e) => set({ network: e.target.value })} className={inputClass}>
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6 space-y-6">
        <h3 className="text-sm font-semibold text-slate-900">Endereço do GF</h3>

        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <label className={labelClass}>CEP</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={values.addressZipcode}
                onChange={(e) => set({ addressZipcode: formatZipcode(e.target.value) })}
                className={inputClass}
                placeholder="00000-000"
              />
              <button
                type="button"
                onClick={handleZipLookup}
                disabled={zipLoading || normalizeZipcode(values.addressZipcode).length !== 8}
                className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                title="Buscar endereço pelo CEP"
              >
                {zipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            {zipError && <p className="text-xs text-red-600 mt-1">{zipError}</p>}
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Rua</label>
            <input
              type="text"
              value={values.addressStreet}
              onChange={(e) => set({ addressStreet: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Número</label>
            <input
              type="text"
              value={values.addressNumber}
              onChange={(e) => set({ addressNumber: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <label className={labelClass}>Complemento</label>
            <input
              type="text"
              value={values.addressComplement}
              onChange={(e) => set({ addressComplement: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Bairro</label>
            <input
              type="text"
              value={values.addressNeighborhood}
              onChange={(e) => set({ addressNeighborhood: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Cidade</label>
            <input
              type="text"
              value={values.addressCity}
              onChange={(e) => set({ addressCity: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>UF</label>
            <input
              type="text"
              maxLength={2}
              value={values.addressState}
              onChange={(e) => set({ addressState: e.target.value.toUpperCase() })}
              className={inputClass}
            />
          </div>
        </div>

        <LocationPicker
          value={{ latitude: values.latitude, longitude: values.longitude }}
          address={{
            addressStreet: values.addressStreet,
            addressNumber: values.addressNumber,
            addressNeighborhood: values.addressNeighborhood,
            addressCity: values.addressCity,
            addressState: values.addressState,
            addressZipcode: values.addressZipcode,
          }}
          onChange={(next) =>
            set({
              latitude: next.latitude,
              longitude: next.longitude,
              addressStreet: next.address?.addressStreet ?? values.addressStreet,
              addressNeighborhood: next.address?.addressNeighborhood ?? values.addressNeighborhood,
              addressCity: next.address?.addressCity ?? values.addressCity,
              addressState: next.address?.addressState ?? values.addressState,
              addressZipcode: next.address?.addressZipcode ?? values.addressZipcode,
            })
          }
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
        <div>
          <label className={labelClass}>Dia da Semana *</label>
          <select value={values.meetingDay} onChange={(e) => set({ meetingDay: e.target.value })} className={inputClass}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Horário *</label>
          <input
            type="time"
            value={values.meetingTime}
            onChange={(e) => set({ meetingTime: e.target.value })}
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
        ) : (
          <Link to="/app-ui/cells" className="px-6 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancelar
          </Link>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Salvando...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
