import { useEffect, useState } from 'react';
import { Building2, ChevronDown, FileText, MapPin, Phone, Save, UserRound, X } from 'lucide-react';

import { apiBase } from '../../lib/apiBase';
import { Permissao } from '../../lib/permissoes/Permissao';
import { FONTE_MODELO_FAMILIA, useFonteModelo } from '../../lib/fonteModelo';

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

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

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
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  useFonteModelo();

  useEffect(() => {
    if (!open || !type) return;
    setForm({ ...emptyForm, churchId: initialChurchId || availableChurches[0]?.id || '' });
    setSaving(false);
    setError('');
    setCepStatus('idle');
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

  // CEP: com 8 dígitos busca no ViaCEP e completa só o que estiver vazio.
  const buscarCep = async (cep: string) => {
    setCepStatus('loading');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = res.ok ? await res.json() : null;
      if (!data || data.erro) throw new Error('cep');
      setForm((current) => ({
        ...current,
        addressStreet: current.addressStreet || data.logradouro || '',
        addressNeighborhood: current.addressNeighborhood || data.bairro || '',
        addressCity: current.addressCity || data.localidade || '',
        addressState: current.addressState || data.uf || '',
      }));
      setCepStatus('ok');
    } catch {
      setCepStatus('err');
    }
  };

  const inputClass =
    'h-[50px] w-full rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:shadow-[0_0_0_4px_rgba(15,23,42,.08)] disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
  const labelClass = 'flex min-w-0 flex-col gap-[7px] text-[13px] font-semibold text-slate-700 dark:text-slate-300';
  const cepDica = {
    idle: { texto: '· comece pelo CEP', cor: 'text-slate-500' },
    loading: { texto: '· buscando endereço…', cor: 'text-slate-500' },
    ok: { texto: '· endereço encontrado', cor: 'text-[#15803d]' },
    err: { texto: '· CEP não encontrado', cor: 'text-[#b91c1c]' },
  }[cepStatus];

  const secao = (titulo: string, Icone: typeof UserRound, dica?: { texto: string; cor: string }) => (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
        <Icone className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="text-[15px] font-bold">{titulo}</span>
      {dica ? <span className={`text-xs ${dica.cor}`}>{dica.texto}</span> : null}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center md:p-6" style={{ fontFamily: FONTE_MODELO_FAMILIA }}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => !saving && onClose()} />
      <div className="relative flex h-full max-h-full w-full flex-col overflow-hidden bg-white text-slate-900 shadow-[0_30px_70px_-20px_rgba(15,23,42,.45)] md:h-auto md:w-[min(760px,100%)] md:rounded-3xl dark:bg-slate-800 dark:text-slate-100">
        <div className="flex items-center gap-4 border-b border-[#eef2f6] px-6 py-[22px] dark:border-slate-700">
          <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            {type === 'PJ' ? <Building2 className="h-[26px] w-[26px]" strokeWidth={1.8} /> : <UserRound className="h-[26px] w-[26px]" strokeWidth={1.8} />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-xl font-extrabold tracking-[-.01em]">
              {type === 'PJ' ? 'Cadastro rápido · Pessoa jurídica' : 'Cadastro rápido · Pessoa física'}
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">Só os campos essenciais. Dá para completar depois na ficha.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="grid h-10 w-10 flex-none place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[26px] overflow-y-auto overflow-x-hidden p-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>
          ) : null}

          <div className="flex flex-col gap-3.5">
            {secao('Identificação', type === 'PJ' ? Building2 : UserRound)}
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <label className={`${labelClass} md:col-span-2`}>
                Igreja
                <span className="relative min-w-0">
                  <select
                    value={form.churchId}
                    onChange={(event) => update('churchId', event.target.value)}
                    disabled={lockChurchSelection || saving}
                    className={`${inputClass} appearance-none pr-10`}
                  >
                    <option value="">Selecione</option>
                    {availableChurches.map((church) => (
                      <option key={church.id} value={church.id}>{church.code ? `${church.code} - ` : ''}{church.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </span>
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                {type === 'PJ' ? 'Razão social / Nome fantasia *' : 'Nome completo *'}
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(event) => update('fullName', event.target.value)}
                  placeholder={type === 'PJ' ? 'Ex.: Gráfica Esperança LTDA' : 'Nome e sobrenome'}
                  className={inputClass}
                />
              </label>
              {type === 'PF' ? (
                <label className={labelClass}>
                  CPF
                  <input type="text" inputMode="numeric" value={form.cpf} onChange={(event) => update('cpf', formatCpf(event.target.value))} className={inputClass} placeholder="000.000.000-00" />
                </label>
              ) : (
                <label className={labelClass}>
                  CNPJ *
                  <input type="text" inputMode="numeric" value={form.cnpj} onChange={(event) => update('cnpj', formatCnpj(event.target.value))} className={inputClass} placeholder="00.000.000/0000-00" />
                </label>
              )}
              <label className={labelClass}>
                E-mail
                <input type="email" inputMode="email" value={form.email} onChange={(event) => update('email', event.target.value)} className={inputClass} placeholder="exemplo@email.com" />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            {secao('Contato', Phone)}
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <label className={labelClass}>
                Celular
                <input type="tel" inputMode="tel" value={form.mobile} onChange={(event) => update('mobile', formatPhone(event.target.value))} className={inputClass} placeholder="(19) 98765-4321" />
              </label>
              <label className={labelClass}>
                Telefone
                <input type="tel" inputMode="tel" value={form.phone} onChange={(event) => update('phone', formatPhone(event.target.value))} className={inputClass} placeholder="(19) 3456-7890" />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            {secao('Endereço', MapPin, cepDica)}
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <label className={labelClass}>
                CEP
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.addressZipcode}
                  onChange={(event) => {
                    const valor = formatZipcode(event.target.value);
                    update('addressZipcode', valor);
                    const digitos = digitsOnly(valor);
                    if (digitos.length === 8) void buscarCep(digitos);
                    else if (cepStatus !== 'idle') setCepStatus('idle');
                  }}
                  className={inputClass}
                  placeholder="00000-000"
                />
              </label>
              <label className={labelClass}>
                Número
                <input type="text" value={form.addressNumber} onChange={(event) => update('addressNumber', event.target.value)} className={inputClass} placeholder="Nº" />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Endereço
                <input type="text" value={form.addressStreet} onChange={(event) => update('addressStreet', event.target.value)} className={inputClass} placeholder="Rua, avenida…" />
              </label>
              <label className={labelClass}>
                Bairro
                <input type="text" value={form.addressNeighborhood} onChange={(event) => update('addressNeighborhood', event.target.value)} className={inputClass} />
              </label>
              <label className={labelClass}>
                Cidade
                <input type="text" value={form.addressCity} onChange={(event) => update('addressCity', event.target.value)} className={inputClass} />
              </label>
              <label className={labelClass}>
                Estado
                <span className="relative min-w-0">
                  <select
                    value={form.addressState}
                    onChange={(event) => update('addressState', event.target.value)}
                    className={`${inputClass} appearance-none pr-10`}
                  >
                    <option value="">Selecione</option>
                    {/* Valor gravado já existente fora da lista continua aparecendo. */}
                    {form.addressState && !UFS.includes(form.addressState) ? <option value={form.addressState}>{form.addressState}</option> : null}
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            {secao('Observações', FileText, { texto: '· opcional', cor: 'text-slate-500' })}
            <textarea
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              rows={3}
              placeholder="Informações complementares"
              className={`${inputClass} h-auto resize-y py-3`}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#eef2f6] px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-[50px] flex-none whitespace-nowrap rounded-[14px] border border-slate-200 bg-white px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <Permissao chave="tela_lancamento_recibo.member_quick_create_modal.salvar" rotulo="Salvar cadastro rápido — Member Quick Create Modal" herda="tela_lancamento_recibo.view">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex h-[50px] flex-none items-center gap-2 whitespace-nowrap rounded-[14px] bg-slate-900 px-[22px] text-[15px] font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Save className="h-[18px] w-[18px]" strokeWidth={2} />
              {saving ? 'Salvando...' : `Salvar ${type}`}
            </button>
          </Permissao>
        </div>
      </div>
    </div>
  );
}
