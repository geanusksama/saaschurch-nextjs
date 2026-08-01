import { useNavigate } from 'react-router';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { apiBase } from '../../lib/apiBase';
import { CellForm, EMPTY_CELL_FORM, type CellFormValues } from './cells/CellForm';

export function CellNew() {
  const navigate = useNavigate();
  const [values, setValues] = useState<CellFormValues>(EMPTY_CELL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('mrm_token');
      const response = await fetch(`${apiBase}/cell-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Erro ao salvar o GF');
      navigate(`/app-ui/cells/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar o GF');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
          <Save className="w-6 h-6 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo GF</h1>
          <p className="text-slate-600 dark:text-slate-400">Cadastre um novo Grupo Familiar</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-4xl">
        <CellForm
          values={values}
          onChange={setValues}
          onSubmit={handleSubmit}
          saving={saving}
          error={error}
          submitLabel="Salvar GF"
        />
      </div>
    </div>
  );
}
