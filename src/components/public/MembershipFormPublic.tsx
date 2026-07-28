/**
 * Ficha de adesão — formulário público de "Quero ser Membro".
 *
 * A pessoa chega aqui pelo link enviado no WhatsApp (ou pela timeline do
 * atendimento). O token na URL é a credencial: não há login.
 *
 * O que ela preenche aqui é exatamente o que a secretaria avalia antes de
 * aprovar; aprovado, vira cadastro de membro com número de ROL.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2, Check, AlertTriangle, Camera, Send } from 'lucide-react';
import { toast } from 'sonner';

interface FormData {
  firstName: string; lastName: string; preferredName: string;
  birthDate: string; email: string; cpf: string; rg: string;
  phone: string; maritalStatus: string;
  fatherName: string; motherName: string;
  naturalityCity: string; naturalityState: string;
  addressZipcode: string; addressStreet: string; addressNumber: string;
  addressComplement: string; addressNeighborhood: string;
  addressCity: string; addressState: string;
  churchEntryDate: string; baptized: string; baptismDate: string;
  emergencyName: string; emergencyPhone: string;
  photoUrl: string; notes: string;
}

const EMPTY: FormData = {
  firstName: '', lastName: '', preferredName: '', birthDate: '', email: '', cpf: '', rg: '',
  phone: '', maritalStatus: '', fatherName: '', motherName: '', naturalityCity: '',
  naturalityState: '', addressZipcode: '', addressStreet: '', addressNumber: '',
  addressComplement: '', addressNeighborhood: '', addressCity: '', addressState: '',
  churchEntryDate: '', baptized: '', baptismDate: '', emergencyName: '', emergencyPhone: '',
  photoUrl: '', notes: '',
};

function Field({ label, required, children, className = '' }: {
  label: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-semibold text-slate-300">
        {label}{required && <span className="text-emerald-400"> *</span>}
      </label>
      {children}
    </div>
  );
}

/** Validação de CPF (dígitos verificadores) — espelha a checagem do servidor. */
function cpfValido(raw: string): boolean {
  const d = String(raw).replace(/\D/g, '');
  // 11 digitos e nunca todos iguais (111.111.111-11 passaria na conta)
  if (d.length !== 11 || new RegExp(`^(\\d)\\1{10}$`).test(d)) return false;
  const calc = (fatorInicial: number) => {
    let soma = 0;
    for (let i = 0; i < fatorInicial - 1; i++) soma += Number(d[i]) * (fatorInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(10) === Number(d[9]) && calc(11) === Number(d[10]);
}

const inputCls =
  'w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-100 ' +
  'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50';

export default function MembershipFormPublic() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [done, setDone] = useState(false);
  const [locked, setLocked] = useState(false);
  const [churchName, setChurchName] = useState('');
  const [form, setForm] = useState<FormData>(EMPTY);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/membership-form/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Formulário não encontrado.');
        setChurchName(data.churchName ?? '');
        setLocked(!!data.locked);
        if (data.formData) setForm({ ...EMPTY, ...data.formData });
        if (data.submittedAt) setDone(true);
        // o nome do pedido preenche o primeiro campo, se ainda estiver vazio
        if (!data.formData && data.name) {
          const partes = String(data.name).trim().split(/\s+/);
          setForm(f => ({ ...f, firstName: partes[0] ?? '', lastName: partes.slice(1).join(' ') }));
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Formulário não encontrado.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  /** Busca o endereço pelo CEP — poupa a pessoa de digitar tudo. */
  const buscarCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) return;
      setForm(f => ({
        ...f,
        addressStreet: data.logradouro || f.addressStreet,
        addressNeighborhood: data.bairro || f.addressNeighborhood,
        addressCity: data.localidade || f.addressCity,
        addressState: data.uf || f.addressState,
      }));
    } catch { /* CEP offline não impede o preenchimento manual */ }
  };

  const uploadFile = async (file: File, _tipo: string) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/whatsapp/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Falha no envio do arquivo');
      setForm(f => ({ ...f, photoUrl: data.url }));
      toast.success('Foto anexada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao anexar');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const faltando: string[] = [];
    if (!form.firstName.trim()) faltando.push('Nome');
    if (!form.lastName.trim()) faltando.push('Sobrenome');
    if (!form.birthDate) faltando.push('Data de nascimento');
    if (!form.cpf.trim()) faltando.push('CPF');
    if (faltando.length) {
      toast.error(`Preencha: ${faltando.join(', ')}`);
      return;
    }
    if (!cpfValido(form.cpf)) {
      toast.error('CPF inválido. Confira os números — é com ele que você acessa o Portal do Membro.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/public/membership-form/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: form, documents: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao enviar');
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-100 mb-1">Link indisponível</h1>
          <p className="text-sm text-slate-400">{erro}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Ficha de Adesão</h1>
          <p className="text-sm text-slate-400">
            {churchName || 'Nossa igreja'} · preencha seus dados para a secretaria avaliar
          </p>
        </div>

        {done && (
          <div className="mb-5 rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-4 flex gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-emerald-300">Ficha enviada!</p>
              <p className="text-slate-400 mt-0.5">
                A secretaria vai avaliar seus dados e documentos. Você recebe o resultado pelo
                WhatsApp{locked ? '.' : ' — se precisar corrigir algo, pode reenviar por aqui.'}
              </p>
            </div>
          </div>
        )}

        <fieldset disabled={locked || saving} className="flex flex-col gap-5 disabled:opacity-60">
          {/* Dados pessoais */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-bold text-emerald-400 mb-3">Dados pessoais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nome" required>
                <input className={inputCls} value={form.firstName} onChange={e => set('firstName', e.target.value)} />
              </Field>
              <Field label="Sobrenome" required>
                <input className={inputCls} value={form.lastName} onChange={e => set('lastName', e.target.value)} />
              </Field>
              <Field label="Nome preferido">
                <input className={inputCls} placeholder="Como gosta de ser chamado(a)"
                  value={form.preferredName} onChange={e => set('preferredName', e.target.value)} />
              </Field>
              <Field label="Data de nascimento" required>
                <input type="date" className={inputCls} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} />
              </Field>
              <Field label="CPF" required>
                <input
                  className={`${inputCls} ${form.cpf && !cpfValido(form.cpf) ? 'border-red-500/60' : ''}`}
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={e => set('cpf', e.target.value)}
                />
                {form.cpf && !cpfValido(form.cpf) && (
                  <span className="text-[11px] text-red-400">CPF inválido</span>
                )}
              </Field>
              <Field label="RG">
                <input className={inputCls} value={form.rg} onChange={e => set('rg', e.target.value)} />
              </Field>
              <Field label="E-mail">
                <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} />
              </Field>
              <Field label="Telefone">
                <input className={inputCls} placeholder="(19) 99999-9999" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </Field>
              <Field label="Estado civil">
                <select className={inputCls} value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="single">Solteiro(a)</option>
                  <option value="married">Casado(a)</option>
                  <option value="divorced">Divorciado(a)</option>
                  <option value="widowed">Viúvo(a)</option>
                </select>
              </Field>
              <Field label="Naturalidade (cidade)">
                <input className={inputCls} placeholder="Ex.: Campinas" value={form.naturalityCity} onChange={e => set('naturalityCity', e.target.value)} />
              </Field>
              <Field label="Naturalidade (UF)">
                <input className={inputCls} maxLength={2} placeholder="SP" value={form.naturalityState} onChange={e => set('naturalityState', e.target.value.toUpperCase())} />
              </Field>
            </div>
          </section>

          {/* Filiação */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-bold text-emerald-400 mb-3">Filiação</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nome do pai">
                <input className={inputCls} value={form.fatherName} onChange={e => set('fatherName', e.target.value)} />
              </Field>
              <Field label="Nome da mãe">
                <input className={inputCls} value={form.motherName} onChange={e => set('motherName', e.target.value)} />
              </Field>
            </div>
          </section>

          {/* Endereço */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-bold text-emerald-400 mb-3">Endereço</h2>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <Field label="CEP" className="col-span-2">
                <input className={inputCls} placeholder="00000-000" value={form.addressZipcode}
                  onChange={e => set('addressZipcode', e.target.value)}
                  onBlur={e => buscarCep(e.target.value)} />
              </Field>
              <Field label="Rua" className="col-span-4">
                <input className={inputCls} value={form.addressStreet} onChange={e => set('addressStreet', e.target.value)} />
              </Field>
              <Field label="Número" className="col-span-2 sm:col-span-1">
                <input className={inputCls} value={form.addressNumber} onChange={e => set('addressNumber', e.target.value)} />
              </Field>
              <Field label="Complemento" className="col-span-2">
                <input className={inputCls} value={form.addressComplement} onChange={e => set('addressComplement', e.target.value)} />
              </Field>
              <Field label="Bairro" className="col-span-2 sm:col-span-3">
                <input className={inputCls} value={form.addressNeighborhood} onChange={e => set('addressNeighborhood', e.target.value)} />
              </Field>
              <Field label="Cidade" className="col-span-2 sm:col-span-5">
                <input className={inputCls} value={form.addressCity} onChange={e => set('addressCity', e.target.value)} />
              </Field>
              <Field label="UF">
                <input className={inputCls} maxLength={2} value={form.addressState} onChange={e => set('addressState', e.target.value.toUpperCase())} />
              </Field>
            </div>
          </section>

          {/* Vida na igreja */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-bold text-emerald-400 mb-3">Vida na igreja</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Data de entrada na igreja">
                <input type="date" className={inputCls} value={form.churchEntryDate} onChange={e => set('churchEntryDate', e.target.value)} />
              </Field>
              <Field label="É batizado(a)?">
                <select className={inputCls} value={form.baptized} onChange={e => set('baptized', e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </Field>
              {form.baptized === 'sim' && (
                <Field label="Data do batismo">
                  <input type="date" className={inputCls} value={form.baptismDate} onChange={e => set('baptismDate', e.target.value)} />
                </Field>
              )}
            </div>
          </section>

          {/* Emergência */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-bold text-emerald-400 mb-3">Contato de emergência</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nome">
                <input className={inputCls} value={form.emergencyName} onChange={e => set('emergencyName', e.target.value)} />
              </Field>
              <Field label="Telefone">
                <input className={inputCls} value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} />
              </Field>
            </div>
          </section>

          {/* Foto — vira a foto do membro na secretaria e nos dispositivos */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-bold text-emerald-400 mb-1">Sua foto</h2>
            <p className="text-xs text-slate-500 mb-3">
              Tire uma foto do seu rosto, de frente e com boa luz. Ela é usada na sua ficha de
              membro e para te identificar nos dispositivos da igreja.
            </p>

            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 hover:border-emerald-600 hover:text-emerald-400 overflow-hidden">
                  {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : form.photoUrl ? (
                    <img src={form.photoUrl} alt="Sua foto" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera className="w-6 h-6 mb-1" />
                      <span className="text-[10px]">Tirar foto</span>
                    </>
                  )}
                </div>
                {/* `capture` abre a câmera frontal direto no celular */}
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'foto')}
                />
              </label>

              {form.photoUrl && (
                <button
                  onClick={() => set('photoUrl', '')}
                  className="text-xs text-slate-400 hover:text-red-400 underline"
                >
                  tirar outra
                </button>
              )}
            </div>
          </section>

          <Field label="Observações (opcional)">
            <textarea rows={3} className={`${inputCls} h-auto py-2 resize-y`}
              placeholder="Algo que a secretaria precise saber"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>

          {!locked && (
            <button
              onClick={submit}
              disabled={saving}
              className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {done ? 'Reenviar ficha corrigida' : 'Enviar ficha para avaliação'}
            </button>
          )}
        </fieldset>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          Seus dados são usados apenas para o cadastro de membresia.
        </p>
      </div>
    </div>
  );
}
