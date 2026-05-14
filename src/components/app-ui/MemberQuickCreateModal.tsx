import { useEffect, useState } from 'react';
import { Building2, Save, UserRound, X } from 'lucide-react';

import { apiBase } from '../../lib/apiBase';

type ChurchOption = {
  id: string;
  name: string;
  code?: string | null;
};

type QuickCreateType = 'PF' | 'PJ';

type Props = {
  open: boolean;
  type: QuickCreateType | null;
  initialChurchId: string;
  availableChurches: ChurchOption[];
  lockChurchSelection?: boolean;
  onClose: () => void;
  onCreated: (created: any) => void;
};

type FormState = {
  churchId: string;
  fullName: string;
  cpf: string;
  cnpj: string;
  email: string;
  phone: string;
  mobile: string;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZipcode: string;
  notes: string;
};

const emptyForm: FormState = {
  churchId: '',
  fullName: '',
  cpf: '',
  cnpj: '',
  email: '',
  phone: '',
  mobile: '',
  addressStreet: '',
  addressNumber: '',
  addressNeighborhood: '',
  addressCity: '',
  addressState: '',
  addressZipcode: '',
  notes: '',
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return '';
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCnpj(value: string) {
  const digits = digitsOnly(value).slice(0, 14);
  if (!digits) return '';
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function formatZipcode(value: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return digits.replace(/(\d{5})(\d{1,3})/, '$1-$2');
}

export function MemberQuickCreateModal({
  open,
  type,
  initialChurchId,
  availableChurches,
  lockChurchSelection = false,
  onClose,
  onCreated,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !type) return;
    setForm({ ...emptyForm, churchId: initialChurchId || availableChurches[0]?.id || '' });
    setSaving(false);
    setError('');
  }, [open, type, initialChurchId, availableChurches]);

  if (!open || !type) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    const token = localStorage.getItem('mrm_token');
    if (!token) {
      setError('Sessao expirada. Faca login novamente.');
      return;
    }

    if (!form.churchId) {
      setError('Selecione a igreja para continuar.');
      return;
    }

    if (!form.fullName.trim()) {
      setError(type === 'PJ' ? 'Informe a razão social ou nome fantasia.' : 'Informe o nome do cadastro PF.');
      return;
    }

    if (type === 'PJ' && !digitsOnly(form.cnpj)) {
      setError('Informe o CNPJ do cadastro PJ.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload = {
        memberType: type,
        fullName: form.fullName.trim(),
        cpf: type === 'PF' ? digitsOnly(form.cpf) || undefined : undefined,
        cnpj: type === 'PJ' ? digitsOnly(form.cnpj) || undefined : undefined,
        email: form.email.trim() || undefined,
        phone: digitsOnly(form.phone) || undefined,
        mobile: digitsOnly(form.mobile) || undefined,
        addressStreet: form.addressStreet.trim() || undefined,
        addressNumber: form.addressNumber.trim() || undefined,
        addressNeighborhood: form.addressNeighborhood.trim() || undefined,
        addressCity: form.addressCity.trim() || undefined,
        addressState: form.addressState.trim() || undefined,
        addressZipcode: digitsOnly(form.addressZipcode) || undefined,
        notes: form.notes.trim() || undefined,
        membershipStatus: 'ATIVO',
        membershipDate: new Date().toISOString().slice(0, 10),
      };

      const response = await fetch(`${apiBase}/churches/${form.churchId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.json().catch(() => ({}));
        throw new Error(message.error || 'Falha ao salvar cadastro.');
      }

      const created = await response.json();
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar cadastro.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';
  const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/50" onClick={() => !saving && onClose()} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[94%] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className={`mt-1 flex h-11 w-11 items-center justify-center rounded-xl ${type === 'PJ' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {type === 'PJ' ? <Building2 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{type === 'PJ' ? 'Cadastro rápido PJ' : 'Cadastro rápido PF'}</h2>
              <p className="text-sm text-slate-500">Cadastro exclusivo com os campos essenciais.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" disabled={saving}>
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass}>Igreja</label>
              <select
                value={form.churchId}
                onChange={(event) => update('churchId', event.target.value)}
                disabled={lockChurchSelection || saving}
                className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`}
              >
                <option value="">Selecione</option>
                {availableChurches.map((church) => (
                  <option key={church.id} value={church.id}>{church.code ? `${church.code} - ` : ''}{church.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>{type === 'PJ' ? 'Razão Social / Nome Fantasia *' : 'Nome Completo *'}</label>
              <input type="text" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} className={inputClass} />
            </div>

            {type === 'PF' ? (
              <div>
                <label className={labelClass}>CPF</label>
                <input type="text" value={form.cpf} onChange={(event) => update('cpf', formatCpf(event.target.value))} className={inputClass} placeholder="000.000.000-00" />
              </div>
            ) : (
              <div>
                <label className={labelClass}>CNPJ *</label>
                <input type="text" value={form.cnpj} onChange={(event) => update('cnpj', formatCnpj(event.target.value))} className={inputClass} placeholder="00.000.000/0000-00" />
              </div>
            )}

            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Telefone</label>
              <input type="text" value={form.phone} onChange={(event) => update('phone', formatPhone(event.target.value))} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Celular</label>
              <input type="text" value={form.mobile} onChange={(event) => update('mobile', formatPhone(event.target.value))} className={inputClass} />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Endereço</label>
              <input type="text" value={form.addressStreet} onChange={(event) => update('addressStreet', event.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Número</label>
              <input type="text" value={form.addressNumber} onChange={(event) => update('addressNumber', event.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Bairro</label>
              <input type="text" value={form.addressNeighborhood} onChange={(event) => update('addressNeighborhood', event.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Cidade</label>
              <input type="text" value={form.addressCity} onChange={(event) => update('addressCity', event.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Estado</label>
              <input type="text" value={form.addressState} onChange={(event) => update('addressState', event.target.value.toUpperCase())} className={inputClass} maxLength={2} />
            </div>

            <div>
              <label className={labelClass}>CEP</label>
              <input type="text" value={form.addressZipcode} onChange={(event) => update('addressZipcode', formatZipcode(event.target.value))} className={inputClass} />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Observações</label>
              <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} className={`${inputClass} min-h-24 resize-y`} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" disabled={saving}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : `Salvar ${type}`}
          </button>
        </div>
      </div>
    </>
  );
}