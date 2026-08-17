/**
 * Campos do "histórico em outra igreja" — a vida eclesiástica do membro antes
 * de chegar aqui. Compartilhado entre o perfil do membro (aba Outras Igrejas)
 * e a tela de Novo Membro, para os dois formulários nunca divergirem.
 *
 * Títulos são texto livre com sugestões (datalist): a igreja de origem pode
 * usar nomenclatura que não existe no nosso cadastro de títulos.
 */

export type PreviousChurchForm = {
  id: string;
  churchName: string;
  ecclesiasticalTitle: string;
  conversionDate: string;
  baptismDate: string;
  consecrationDate: string;
  consecrationTitle: string;
  pastorName: string;
  functions: string;
  notes: string;
};

export type PreviousChurchRow = {
  id: string;
  churchName: string;
  ecclesiasticalTitle: string | null;
  conversionDate: string | null;
  baptismDate: string | null;
  consecrationDate: string | null;
  consecrationTitle: string | null;
  pastorName: string | null;
  functions: string | null;
  notes: string | null;
};

export const emptyPreviousChurchForm: PreviousChurchForm = {
  id: '',
  churchName: '',
  ecclesiasticalTitle: '',
  conversionDate: '',
  baptismDate: '',
  consecrationDate: '',
  consecrationTitle: '',
  pastorName: '',
  functions: '',
  notes: '',
};

/** Converte a linha vinda da API no formato do formulário. */
export function previousChurchRowToForm(row: PreviousChurchRow): PreviousChurchForm {
  const day = (v: string | null) => (v ? String(v).slice(0, 10) : '');
  return {
    id: row.id,
    churchName: row.churchName || '',
    ecclesiasticalTitle: row.ecclesiasticalTitle || '',
    conversionDate: day(row.conversionDate),
    baptismDate: day(row.baptismDate),
    consecrationDate: day(row.consecrationDate),
    consecrationTitle: row.consecrationTitle || '',
    pastorName: row.pastorName || '',
    functions: row.functions || '',
    notes: row.notes || '',
  };
}

/** Payload enviado à API (campos vazios viram null). */
export function previousChurchPayload(form: PreviousChurchForm) {
  const t = (v: string) => v.trim() || null;
  return {
    churchName: form.churchName.trim(),
    ecclesiasticalTitle: t(form.ecclesiasticalTitle),
    conversionDate: t(form.conversionDate),
    baptismDate: t(form.baptismDate),
    consecrationDate: t(form.consecrationDate),
    consecrationTitle: t(form.consecrationTitle),
    pastorName: t(form.pastorName),
    functions: t(form.functions),
    notes: t(form.notes),
  };
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

export function PreviousChurchFields({
  form,
  onChange,
  titleOptions = [],
  idPrefix = 'prev-church',
}: {
  form: PreviousChurchForm;
  onChange: (patch: Partial<PreviousChurchForm>) => void;
  /** Títulos cadastrados, usados só como sugestão. */
  titleOptions?: string[];
  idPrefix?: string;
}) {
  const listId = `${idPrefix}-titles`;
  return (
    <div className="space-y-4">
      <datalist id={listId}>
        {titleOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div>
        <label className={labelClass}>Nome da igreja *</label>
        <input
          value={form.churchName}
          onChange={(e) => onChange({ churchName: e.target.value })}
          placeholder="Ex.: Assembleia de Deus - Belém"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Título eclesiástico naquela igreja</label>
          <input
            value={form.ecclesiasticalTitle}
            onChange={(e) => onChange({ ecclesiasticalTitle: e.target.value })}
            list={listId}
            placeholder="Ex.: Diácono"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Nome do pastor</label>
          <input
            value={form.pastorName}
            onChange={(e) => onChange({ pastorName: e.target.value })}
            placeholder="Pastor responsável"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Data em que aceitou Jesus</label>
          <input
            type="date"
            value={form.conversionDate}
            onChange={(e) => onChange({ conversionDate: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Data do batismo</label>
          <input
            type="date"
            value={form.baptismDate}
            onChange={(e) => onChange({ baptismDate: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Data da consagração</label>
          <input
            type="date"
            value={form.consecrationDate}
            onChange={(e) => onChange({ consecrationDate: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Título da consagração</label>
          <input
            value={form.consecrationTitle}
            onChange={(e) => onChange({ consecrationTitle: e.target.value })}
            list={listId}
            placeholder="Ex.: Presbítero"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Funções exercidas</label>
        <input
          value={form.functions}
          onChange={(e) => onChange({ functions: e.target.value })}
          placeholder="Ex.: Professor de EBD, Líder de louvor"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Observações</label>
        <textarea
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={2}
          className={inputClass}
        />
      </div>
    </div>
  );
}
