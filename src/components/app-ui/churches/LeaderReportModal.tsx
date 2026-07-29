import { useMemo, useState } from 'react';
import { Printer, X, Columns, Image as ImageIcon, FileText, LayoutGrid, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  CHANGE_FIELDS,
  DEFAULT_CHANGE_FIELDS,
  DEFAULT_HISTORY_COLUMNS,
  HISTORY_COLUMNS,
  buildLeaderReportBody,
  dateLabel,
  leaderLabel,
  printLeaderReport,
  scopeLeaderReportStyles,
  type ChangeFieldKey,
  type HistoryColumnKey,
  type LeaderReportData,
  type LeaderReportKind,
} from '../../../lib/leaderReport';

/** Imagem oferecida na seleção — foto do templo ou de um dos dirigentes. */
type PickableImage = {
  id: string;
  url: string;
  label: string;
  role: 'templo' | 'assume' | 'anterior';
};

interface Props {
  onClose: () => void;
  loading: boolean;
  error: string;
  data: LeaderReportData | null;
  /** Movimentação pré-selecionada quando o modal abre pelo botão da linha. */
  initialRecordId?: string;
  initialKind?: LeaderReportKind;
  /** Converte URLs de foto (HEIC/WEBP passam pelo conversor do backend). */
  resolveImageUrl: (url?: string | null) => string;
}

/**
 * Montado apenas enquanto aberto (o pai desmonta ao fechar), então o estado de
 * configuração nasce já com o tipo/movimentação que originou a abertura — sem
 * efeito de reset.
 */
export function LeaderReportModal({
  onClose, loading, error, data, initialRecordId, initialKind = 'change', resolveImageUrl,
}: Props) {
  const [kind, setKind] = useState<LeaderReportKind>(initialKind);
  const [recordId, setRecordId] = useState(initialRecordId || '');
  const [fields, setFields] = useState<ChangeFieldKey[]>(DEFAULT_CHANGE_FIELDS);
  const [columns, setColumns] = useState<HistoryColumnKey[]>(DEFAULT_HISTORY_COLUMNS);
  const [pickedImages, setPickedImages] = useState<string[] | null>(null);
  const [panel, setPanel] = useState<'campos' | 'imagens' | null>('campos');
  const [printing, setPrinting] = useState(false);

  const records = useMemo(() => data?.records || [], [data]);
  const activeRecord = useMemo(
    () => records.find((item) => item.id === recordId) || records[0] || null,
    [records, recordId]
  );

  /** Fotos do templo + dirigentes envolvidos, na ordem em que entram no card. */
  const availableImages = useMemo<PickableImage[]>(() => {
    if (!data) return [];
    const list: PickableImage[] = (data.photos || [])
      .filter((photo) => photo.photoUrl)
      .map((photo, index) => ({
        id: `photo:${photo.id}`,
        url: resolveImageUrl(photo.photoUrl),
        label: photo.fieldName || `Foto do templo ${index + 1}`,
        role: 'templo' as const,
      }));

    const newLeader = activeRecord?.newLeaderMember;
    if (newLeader?.photoUrl) {
      list.push({
        id: `assume:${newLeader.id}`,
        url: resolveImageUrl(newLeader.photoUrl),
        label: `${newLeader.fullName} (assume)`,
        role: 'assume',
      });
    }
    const previous = activeRecord?.previousLeaderMember;
    if (previous?.photoUrl) {
      list.push({
        id: `anterior:${previous.id}`,
        url: resolveImageUrl(previous.photoUrl),
        label: `${previous.fullName} (anterior)`,
        role: 'anterior',
      });
    }
    return list;
  }, [data, activeRecord, resolveImageUrl]);

  // Pré-seleção: 2 fotos do templo + a foto de quem assume — exatamente a
  // composição das três molduras do card usado hoje na regional.
  const defaultImageIds = useMemo(() => {
    const temples = availableImages.filter((image) => image.role === 'templo').slice(0, 2);
    const incoming = availableImages.find((image) => image.role === 'assume');
    return [...temples, ...(incoming ? [incoming] : [])].map((image) => image.id);
  }, [availableImages]);

  // `null` = usuário ainda não mexeu, vale a pré-seleção derivada das fotos.
  const selectedImages = pickedImages ?? defaultImageIds;

  const options = useMemo(
    () => ({
      kind,
      recordId: activeRecord?.id,
      fields,
      columns,
      images: selectedImages
        .map((id) => availableImages.find((image) => image.id === id)?.url)
        .filter((url): url is string => Boolean(url)),
    }),
    [kind, activeRecord, fields, columns, selectedImages, availableImages]
  );

  const previewHtml = useMemo(() => (data ? buildLeaderReportBody(data, options) : ''), [data, options]);
  const scopedStyles = useMemo(() => scopeLeaderReportStyles('.leader-report-preview'), []);

  const toggle = <T,>(list: T[], value: T, setter: (next: T[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const handlePrint = async () => {
    if (!data || printing) return;
    setPrinting(true);
    try {
      await printLeaderReport(data, options);
    } catch (printError) {
      toast.error(printError instanceof Error ? printError.message : 'Falha ao abrir a impressão.');
    } finally {
      setPrinting(false);
    }
  };

  const tabButton = (value: LeaderReportKind, label: string, Icon: typeof FileText) => (
    <button
      type="button"
      onClick={() => setKind(value)}
      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-colors ${
        kind === value ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  const changeFieldGroup = (group: 'card' | 'igreja', title: string) => (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      {CHANGE_FIELDS.filter((field) => field.group === group).map((field) => (
        <label key={field.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={fields.includes(field.key)}
            onChange={() => toggle(fields, field.key, setFields)}
            className="rounded border-slate-300 accent-purple-600"
          />
          <span className="text-sm text-slate-700">{field.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    // z-[100]: a topbar do app fica em z-50 e vazava por cima do modal.
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-slate-900/60 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-[1280px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[92vh] sm:rounded-2xl">
        {/* Cabeçalho: título e ações em linhas separadas, para as ações poderem
            quebrar sem nunca colidir com o nome da igreja. */}
        <div className="flex flex-shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Relatórios de Dirigente</p>
              <p className="truncate text-base font-bold text-slate-900">{data?.church?.name || 'Igreja'}</p>
            </div>
            <button type="button" onClick={onClose} className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              {tabButton('change', 'Troca de Dirigente', LayoutGrid)}
              {tabButton('history', 'Histórico', FileText)}
            </div>

            <button
              type="button"
              onClick={() => setPanel((current) => (current === 'campos' ? null : 'campos'))}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold shadow-sm transition-colors ${
                panel === 'campos' ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Columns className="h-3.5 w-3.5" />
              {kind === 'change' ? 'Campos' : 'Colunas'}
            </button>

            <button
              type="button"
              onClick={() => setPanel((current) => (current === 'imagens' ? null : 'imagens'))}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold shadow-sm transition-colors ${
                panel === 'imagens' ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Imagens ({selectedImages.length})
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || printing || !data}
              className="ml-auto flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              {printing ? 'Preparando...' : 'Imprimir'}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Painel lateral de configuração */}
          {panel ? (
            <aside className="w-[260px] flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 lg:w-[300px]">
              {panel === 'campos' ? (
                kind === 'change' ? (
                  <div className="space-y-4">
                    {records.length > 1 ? (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Movimentação</p>
                        <select
                          value={activeRecord?.id || ''}
                          onChange={(event) => setRecordId(event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none"
                        >
                          {records.map((record) => (
                            <option key={record.id} value={record.id}>
                              {leaderLabel(record.newLeaderMember)} — {dateLabel(record.entryDate) || 'sem data'}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {changeFieldGroup('card', 'Dados do card')}
                    {changeFieldGroup('igreja', 'Dados adicionais da igreja')}
                  </div>
                ) : (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Colunas do histórico</p>
                    {HISTORY_COLUMNS.map((column) => (
                      <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={columns.includes(column.key)}
                          onChange={() => toggle(columns, column.key, setColumns)}
                          className="rounded border-slate-300 accent-purple-600"
                        />
                        <span className="text-sm text-slate-700">{column.label}</span>
                      </label>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Imagens do relatório
                  </p>
                  {availableImages.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {availableImages.map((image) => {
                        const active = selectedImages.includes(image.id);
                        return (
                          <button
                            key={image.id}
                            type="button"
                            onClick={() => toggle(selectedImages, image.id, setPickedImages)}
                            className={`relative overflow-hidden rounded-lg border-2 text-left transition-colors ${
                              active ? 'border-purple-500' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={image.url} alt="" className="h-20 w-full object-cover" />
                            {active ? (
                              <span className="absolute right-1 top-1 rounded-full bg-purple-600 p-0.5 text-white">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : null}
                            <span className="block px-1.5 py-1 text-[10px] leading-tight text-slate-600">{image.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-white p-3 text-xs text-slate-500">
                      Nenhuma imagem disponível. Envie fotos na aba <strong>Imagens</strong> da igreja ou cadastre a foto do
                      dirigente no perfil dele.
                    </p>
                  )}
                  <p className="text-[11px] leading-snug text-slate-500">
                    A ordem das molduras segue a ordem em que você marca as imagens.
                  </p>
                </div>
              )}
            </aside>
          ) : null}

          {/* Pré-visualização */}
          <div className="min-w-0 flex-1 overflow-auto bg-slate-200 p-4">
            {loading ? (
              <div className="py-20 text-center text-sm text-slate-500">Carregando dados do relatório...</div>
            ) : error ? (
              <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : data ? (
              <>
                <style>{scopedStyles}</style>
                <div className="leader-report-preview mx-auto w-full max-w-[1050px] bg-white shadow-lg">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
