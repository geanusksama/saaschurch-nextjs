/**
 * Ficha completa do "Quero ser Membro" — versão preenchida direto na home.
 *
 * É a mesma ficha que hoje só existe atrás do link com token
 * (MembershipFormPublic): os nomes dos campos são idênticos, porque quem lê
 * `new_member_requests.form_data` é sempre a mesma avaliação da secretaria e o
 * mesmo mapeamento para `members` na aprovação.
 *
 * O que NÃO entra aqui, de propósito:
 *  - título/zona/seção eleitoral — não é usado no cadastro de membresia;
 *  - formação e profissão — a pessoa atualiza depois, pelo portal do membro.
 *
 * A igreja é escolhida por busca, não por rolagem: a lista pública traz todas
 * as igrejas ativas, de qualquer campo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  buscarEnderecoPorCep, digitos, mascaraCep, mascaraCpf, mascaraRg, mascaraTelefone,
} from './fichaHelpers';

export interface FichaCompleta {
  firstName: string; lastName: string; preferredName: string;
  birthDate: string; gender: string; maritalStatus: string;
  cpf: string; rg: string; email: string; phone: string;
  fatherName: string; motherName: string; spouseName: string;
  naturalityCity: string; naturalityState: string;
  addressZipcode: string; addressStreet: string; addressNumber: string;
  addressComplement: string; addressNeighborhood: string;
  addressCity: string; addressState: string;
  pastChurch: string; ecclesiasticalTitle: string;
  churchEntryDate: string; baptized: string; baptismDate: string;
  emergencyName: string; emergencyPhone: string;
  photoUrl: string; notes: string;
}

export const EMPTY_FICHA: FichaCompleta = {
  firstName: '', lastName: '', preferredName: '', birthDate: '', gender: '', maritalStatus: '',
  cpf: '', rg: '', email: '', phone: '', fatherName: '', motherName: '', spouseName: '',
  naturalityCity: '', naturalityState: '', addressZipcode: '', addressStreet: '',
  addressNumber: '', addressComplement: '', addressNeighborhood: '', addressCity: '',
  addressState: '', pastChurch: '', ecclesiasticalTitle: '', churchEntryDate: '', baptized: '',
  baptismDate: '', emergencyName: '', emergencyPhone: '', photoUrl: '', notes: '',
};

export interface IgrejaPublica { id: string; name: string; code?: string | null }

/**
 * Obrigatórios da ficha. Cônjuge só é exigido de quem se declarou casado(a) —
 * exigir sempre travaria solteiro na tela sem motivo.
 */
export function faltandoNaFicha(f: FichaCompleta, churchId: string): string[] {
  const faltando: string[] = [];
  if (!f.firstName.trim()) faltando.push('Nome');
  if (!f.lastName.trim()) faltando.push('Sobrenome');
  if (!f.birthDate) faltando.push('Data de nascimento');
  if (!f.gender) faltando.push('Sexo');
  if (!f.maritalStatus) faltando.push('Estado civil');
  if (!f.cpf.trim()) faltando.push('CPF');
  if (!f.fatherName.trim()) faltando.push('Nome do pai');
  if (!f.motherName.trim()) faltando.push('Nome da mãe');
  if (f.maritalStatus === 'married' && !f.spouseName.trim()) faltando.push('Nome do cônjuge');
  if (digitos(f.addressZipcode).length !== 8) faltando.push('CEP');
  if (!f.addressStreet.trim()) faltando.push('Rua');
  if (!f.addressNumber.trim()) faltando.push('Número');
  if (!f.addressNeighborhood.trim()) faltando.push('Bairro');
  if (!f.addressCity.trim()) faltando.push('Cidade');
  if (!f.addressState.trim()) faltando.push('UF');
  if (!churchId) faltando.push('Igreja');
  return faltando;
}

/* --------------------------------------------------------------- combobox */

function ChurchCombobox({
  igrejas, valor, onChange, carregando, isDark, inputCls,
}: {
  igrejas: IgrejaPublica[];
  valor: string;
  onChange: (id: string) => void;
  carregando: boolean;
  isDark: boolean;
  inputCls: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  const escolhida = igrejas.find(i => i.id === valor);

  // clicar fora fecha — sem isso a lista fica por cima do resto do formulário
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const filtradas = useMemo(() => {
    const alvo = busca.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const lista = !alvo
      ? igrejas
      : igrejas.filter(i =>
          `${i.name} ${i.code ?? ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(alvo)
        );
    // teto de 60 itens: a busca é o caminho, a lista longa só pesa no celular
    return lista.slice(0, 60);
  }, [igrejas, busca]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className={`${inputCls} flex items-center justify-between text-left`}
      >
        <span className={escolhida ? '' : 'opacity-60'}>
          {carregando
            ? 'Carregando igrejas…'
            : escolhida
              ? escolhida.name
              : 'Busque e escolha a igreja'}
        </span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-60" />
      </button>

      {aberto && (
        <div
          className={`absolute z-50 mt-1 w-full rounded-xl border shadow-xl overflow-hidden ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div className={`p-2 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Digite o nome da igreja"
                className={`w-full pl-8 pr-2 py-2 rounded-lg border text-xs ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {!filtradas.length ? (
              <p className="px-3 py-4 text-center text-[11px] text-slate-400">
                Nenhuma igreja com esse nome.
              </p>
            ) : (
              filtradas.map(i => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => { onChange(i.id); setAberto(false); setBusca(''); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-emerald-500/10 ${
                    isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  {i.id === valor ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <span className="w-3.5 flex-shrink-0" />
                  )}
                  <span className="flex-1">{i.name}</span>
                  {i.code && <span className="text-[10px] text-slate-400">{i.code}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';

/**
 * Fica FORA do componente de propósito: declarado dentro, ele vira um tipo novo
 * a cada render e o React remonta o input — o campo perderia o foco a cada
 * tecla digitada.
 */
function Campo({ label, obrigatorio, children, className = '' }: {
  label: string; obrigatorio?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelCls}>
        {label}{obrigatorio && <span className="text-emerald-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ ficha */

interface Props {
  form: FichaCompleta;
  set: <K extends keyof FichaCompleta>(k: K, v: FichaCompleta[K]) => void;
  patch: (p: Partial<FichaCompleta>) => void;
  isDark: boolean;
  igrejas: IgrejaPublica[];
  carregandoIgrejas: boolean;
  churchId: string;
  onChurchId: (id: string) => void;
  fotoPreview: string;
  onFoto: (file: File) => void;
  onRemoverFoto: () => void;
}

export function MembershipFullFormFields({
  form, set, patch, isDark, igrejas, carregandoIgrejas, churchId, onChurchId,
  fotoPreview, onFoto, onRemoverFoto,
}: Props) {
  const [buscandoCep, setBuscandoCep] = useState(false);

  const inputCls =
    `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
    }`;
  const secaoCls = `rounded-xl border p-3 ${isDark ? 'border-slate-700' : 'border-slate-200'}`;
  const tituloCls = 'text-xs font-bold text-emerald-500 mb-2 uppercase tracking-wide';

  const buscarCep = async (cep: string) => {
    if (digitos(cep).length !== 8) return;
    setBuscandoCep(true);
    const data = await buscarEnderecoPorCep(cep);
    setBuscandoCep(false);
    if (!data) {
      toast.error('CEP não encontrado — preencha o endereço à mão.');
      return;
    }
    patch({
      addressStreet: data.logradouro || form.addressStreet,
      addressNeighborhood: data.bairro || form.addressNeighborhood,
      addressCity: data.localidade || form.addressCity,
      addressState: data.uf || form.addressState,
    });
  };

  return (
    <div className="space-y-3">
      {/* Igreja desejada */}
      <section className={secaoCls}>
        <h3 className={tituloCls}>Igreja que você quer se tornar membro</h3>
        <ChurchCombobox
          igrejas={igrejas}
          valor={churchId}
          onChange={onChurchId}
          carregando={carregandoIgrejas}
          isDark={isDark}
          inputCls={inputCls}
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Todas as igrejas aparecem aqui, de qualquer campo — busque pelo nome. A entrevista é
          feita pela igreja sede do campo; aprovada, sua membresia fica na igreja que você escolheu.
        </p>
      </section>

      {/* Dados pessoais */}
      <section className={secaoCls}>
        <h3 className={tituloCls}>Dados pessoais</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Campo label="Nome" obrigatorio>
            <input className={inputCls} value={form.firstName} onChange={e => set('firstName', e.target.value)} />
          </Campo>
          <Campo label="Sobrenome" obrigatorio>
            <input className={inputCls} value={form.lastName} onChange={e => set('lastName', e.target.value)} />
          </Campo>
          <Campo label="Como gosta de ser chamado(a)" className="col-span-2">
            <input className={inputCls} value={form.preferredName} onChange={e => set('preferredName', e.target.value)} />
          </Campo>
          <Campo label="Data de nascimento" obrigatorio>
            <input type="date" className={inputCls} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} />
          </Campo>
          <Campo label="Sexo" obrigatorio>
            <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">Selecione</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMININO">Feminino</option>
            </select>
          </Campo>
          <Campo label="CPF" obrigatorio>
            <input
              className={inputCls}
              placeholder="000.000.000-00"
              inputMode="numeric"
              value={form.cpf}
              onChange={e => set('cpf', mascaraCpf(e.target.value))}
            />
          </Campo>
          <Campo label="RG">
            <input className={inputCls} value={form.rg} onChange={e => set('rg', mascaraRg(e.target.value))} />
          </Campo>
          <Campo label="E-mail" className="col-span-2">
            <input type="email" inputMode="email" className={inputCls} placeholder="seu@email.com"
              value={form.email} onChange={e => set('email', e.target.value)} />
          </Campo>
          <Campo label="Estado civil" obrigatorio>
            <select className={inputCls} value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)}>
              <option value="">Selecione</option>
              <option value="single">Solteiro(a)</option>
              <option value="married">Casado(a)</option>
              <option value="divorced">Divorciado(a)</option>
              <option value="widowed">Viúvo(a)</option>
            </select>
          </Campo>
          <Campo label="Naturalidade (cidade)">
            <input className={inputCls} placeholder="Ex.: Campinas"
              value={form.naturalityCity} onChange={e => set('naturalityCity', e.target.value)} />
          </Campo>
          <Campo label="Naturalidade (UF)">
            <input className={inputCls} maxLength={2} placeholder="SP" value={form.naturalityState}
              onChange={e => set('naturalityState', e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())} />
          </Campo>
        </div>
      </section>

      {/* Filiação */}
      <section className={secaoCls}>
        <h3 className={tituloCls}>Filiação</h3>
        <div className="grid grid-cols-1 gap-2.5">
          <Campo label="Nome do pai" obrigatorio>
            <input className={inputCls} value={form.fatherName} onChange={e => set('fatherName', e.target.value)} />
          </Campo>
          <Campo label="Nome da mãe" obrigatorio>
            <input className={inputCls} value={form.motherName} onChange={e => set('motherName', e.target.value)} />
          </Campo>
          {form.maritalStatus === 'married' && (
            <Campo label="Nome do cônjuge" obrigatorio>
              <input className={inputCls} value={form.spouseName} onChange={e => set('spouseName', e.target.value)} />
            </Campo>
          )}
        </div>
      </section>

      {/* Endereço */}
      <section className={secaoCls}>
        <h3 className={tituloCls}>Endereço</h3>
        <div className="grid grid-cols-3 gap-2.5">
          <Campo label="CEP" obrigatorio>
            <div className="relative">
              <input
                className={inputCls}
                placeholder="00000-000"
                inputMode="numeric"
                autoComplete="postal-code"
                value={form.addressZipcode}
                onChange={e => {
                  const v = mascaraCep(e.target.value);
                  set('addressZipcode', v);
                  // busca sozinho ao completar: no celular quase ninguém tira o
                  // foco do campo para disparar o blur
                  if (digitos(v).length === 8) void buscarCep(v);
                }}
                onBlur={e => void buscarCep(e.target.value)}
              />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-500" />
              )}
            </div>
          </Campo>
          <Campo label="Rua" obrigatorio className="col-span-2">
            <input className={inputCls} value={form.addressStreet} onChange={e => set('addressStreet', e.target.value)} />
          </Campo>
          <Campo label="Número" obrigatorio>
            <input className={inputCls} inputMode="numeric" value={form.addressNumber} onChange={e => set('addressNumber', e.target.value)} />
          </Campo>
          <Campo label="Complemento" className="col-span-2">
            <input className={inputCls} value={form.addressComplement} onChange={e => set('addressComplement', e.target.value)} />
          </Campo>
          <Campo label="Bairro" obrigatorio className="col-span-3">
            <input className={inputCls} value={form.addressNeighborhood} onChange={e => set('addressNeighborhood', e.target.value)} />
          </Campo>
          <Campo label="Cidade" obrigatorio className="col-span-2">
            <input className={inputCls} value={form.addressCity} onChange={e => set('addressCity', e.target.value)} />
          </Campo>
          <Campo label="UF" obrigatorio>
            <input className={inputCls} maxLength={2} value={form.addressState}
              onChange={e => set('addressState', e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())} />
          </Campo>
        </div>
      </section>

      {/* Vida na igreja — nada aqui é obrigatório */}
      <section className={secaoCls}>
        <h3 className={tituloCls}>Vida na igreja (opcional)</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Campo label="Igreja anterior" className="col-span-2">
            <input className={inputCls} placeholder="Ex.: Assembleia de Deus — Centro"
              value={form.pastChurch} onChange={e => set('pastChurch', e.target.value)} />
          </Campo>
          <Campo label="Título eclesiástico" className="col-span-2">
            <input className={inputCls} placeholder="Ex.: Diácono, Congregado"
              value={form.ecclesiasticalTitle} onChange={e => set('ecclesiasticalTitle', e.target.value)} />
            <p className="text-[10px] text-slate-500 mt-1">
              O título vale como informação para a secretaria: quem define o seu título na igreja é
              a própria secretaria, na aprovação.
            </p>
          </Campo>
          <Campo label="Desde quando frequenta">
            <input type="date" className={inputCls} value={form.churchEntryDate}
              onChange={e => set('churchEntryDate', e.target.value)} />
          </Campo>
          <Campo label="É batizado(a)?">
            <select className={inputCls} value={form.baptized} onChange={e => set('baptized', e.target.value)}>
              <option value="">Selecione</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </Campo>
          {form.baptized === 'sim' && (
            <Campo label="Data do batismo">
              <input type="date" className={inputCls} value={form.baptismDate} onChange={e => set('baptismDate', e.target.value)} />
            </Campo>
          )}
        </div>
      </section>

      {/* Emergência */}
      <section className={secaoCls}>
        <h3 className={tituloCls}>Contato de emergência (opcional)</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Campo label="Nome">
            <input className={inputCls} value={form.emergencyName} onChange={e => set('emergencyName', e.target.value)} />
          </Campo>
          <Campo label="Telefone">
            <input className={inputCls} placeholder="(19) 99999-9999" inputMode="tel"
              value={form.emergencyPhone} onChange={e => set('emergencyPhone', mascaraTelefone(e.target.value))} />
          </Campo>
        </div>
      </section>

      {/* Foto */}
      <section className={secaoCls}>
        <h3 className={tituloCls}>Foto do rosto (opcional)</h3>
        <p className="text-[11px] text-slate-500 mb-2">
          De frente e com boa luz. Ela vira a foto da sua ficha de membro e só é enviada quando
          você concluir o pedido.
        </p>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <div className={`w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden ${
              isDark ? 'border-slate-600 bg-slate-800 text-slate-400' : 'border-slate-300 bg-slate-50 text-slate-400'
            }`}>
              {fotoPreview ? (
                <img src={fotoPreview} alt="Sua foto" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera className="w-5 h-5 mb-1" />
                  <span className="text-[10px]">Tirar foto</span>
                </>
              )}
            </div>
            {/* `capture` abre a câmera frontal direto no celular */}
            <input type="file" accept="image/*" capture="user" className="hidden"
              onChange={e => e.target.files?.[0] && onFoto(e.target.files[0])} />
          </label>
          {fotoPreview && (
            <button type="button" onClick={onRemoverFoto} className="text-xs text-slate-400 hover:text-red-500 underline">
              tirar outra
            </button>
          )}
        </div>
      </section>

      <div>
        <label className={labelCls}>Observações</label>
        <textarea rows={2} className={`${inputCls} resize-none`}
          placeholder="Algo que a secretaria precise saber"
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
    </div>
  );
}

export default MembershipFullFormFields;
