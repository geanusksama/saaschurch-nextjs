import { useNavigate, useParams } from 'react-router';
import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiBase } from '../../lib/apiBase';
import { CellForm, EMPTY_CELL_FORM, leadersFromApi, type CellFormValues } from './cells/CellForm';

export function CellEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState<CellFormValues>(EMPTY_CELL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('mrm_token');
        const res = await fetch(`${apiBase}/cell-groups/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('GF não encontrado');
        const cell = await res.json();
        setValues({
          ...EMPTY_CELL_FORM,
          name: cell.name ?? '',
          network: cell.cellType ?? EMPTY_CELL_FORM.network,
          color: cell.color ?? EMPTY_CELL_FORM.color,
          photo: cell.photo ?? '',
          leaders: leadersFromApi(cell),
          addressStreet: cell.addressStreet ?? '',
          addressNumber: cell.addressNumber ?? '',
          addressComplement: cell.addressComplement ?? '',
          addressNeighborhood: cell.addressNeighborhood ?? '',
          addressCity: cell.addressCity ?? '',
          addressState: cell.addressState ?? '',
          addressZipcode: cell.addressZipcode ?? '',
          latitude: cell.latitude != null ? String(cell.latitude) : '',
          longitude: cell.longitude != null ? String(cell.longitude) : '',
          meetingDay: cell.meetingDay ?? EMPTY_CELL_FORM.meetingDay,
          meetingTime: cell.meetingTime ? String(cell.meetingTime).slice(11, 16) : '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar o GF');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmit() {
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/cell-groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(values),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar o GF');
      navigate(`/app-ui/cells/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar o GF');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-slate-600">Carregando GF...</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
          <Pencil className="w-6 h-6 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Editar GF</h1>
          <p className="text-slate-600 dark:text-slate-400">{values.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-4xl">
        <CellForm
          values={values}
          onChange={setValues}
          onSubmit={handleSubmit}
          saving={saving}
          error={error}
          submitLabel="Salvar alterações"
        />
      </div>
    </div>
  );
}
