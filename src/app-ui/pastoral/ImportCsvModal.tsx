/**
 * Importação de contatos por CSV/Excel → envio em massa.
 *
 * Três fases:
 *  1. Arquivo    — solta/seleciona o arquivo (com download do modelo).
 *  2. Mapeamento — casa as colunas do arquivo com os campos do sistema e mostra
 *                  o resumo do de-para (inválidos, repetidos, já membros, já no
 *                  pipeline, novos).
 *  3. Envio      — mensagem + variáveis + anexos + intervalo + instâncias; ao
 *                  iniciar, o mesmo painel vira o acompanhamento (progresso,
 *                  enviados/pendentes/erros e tempo restante).
 *
 * O envio reaproveita o orquestrador de campanhas já existente: uma mensagem
 * por tick, pela instância livre há mais tempo, respeitando o cooldown mínimo
 * de 5 s por instância (proteção contra bloqueio do número).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X, Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  Users, UserCheck, LayoutGrid, Ban, Send, Timer, Smartphone, Image as ImageIcon,
  Link2, ArrowLeft, ArrowRight, Hourglass, Church, Pause, Play, Square,
} from 'lucide-react';
import { ATTENDANCE_TYPE_LABELS, type AttendanceType } from '../../lib/pastoralKanbanService';
import { useWhatsAppInstances } from '../../hooks/useWhatsAppInstances';
import { exportRows } from './exportUtils';

// campos do sistema (a chave é a variável {{...}} da mensagem)
const IMPORT_FIELDS = [
  { key: 'nome',       label: 'Nome',           required: true,  aliases: ['nome', 'nome completo', 'contato', 'name'] },
  { key: 'telefone',   label: 'Telefone',       required: true,  aliases: ['telefone', 'celular', 'whatsapp', 'fone', 'phone', 'numero'] },
  { key: 'email',      label: 'E-mail',         required: false, aliases: ['email', 'e mail', 'mail'] },
  { key: 'igreja',     label: 'Igreja',         required: false, aliases: ['igreja', 'congregacao'] },
  { key: 'regional',   label: 'Regional',       required: false, aliases: ['regional', 'campo', 'setor'] },
  { key: 'tipo',       label: 'Tipo/Categoria', required: false, aliases: ['tipo', 'categoria', 'assunto', 'motivo'] },
  { key: 'rol',        label: 'ROL',            required: false, aliases: ['rol', 'matricula'] },
  { key: 'cargo',      label: 'Cargo',          required: false, aliases: ['cargo', 'funcao', 'titulo'] },
  { key: 'observacao', label: 'Observação',     required: false, aliases: ['observacao', 'obs', 'anotacao', 'notas'] },
] as const;

const TEMPLATE_VARS = [
  'nome', 'primeiro_nome', 'telefone', 'igreja', 'regional',
  'tipo', 'rol', 'cargo', 'email', 'data_cadastro', 'protocolo',
];

interface Summary {
  total: number; new: number; member: number; pipeline: number;
  both: number; invalid: number; duplicate: number; sendable: number; skipped: number;
}

interface ImportRow {
  id: string;
  row_number: number;
  name: string | null;
  phone: string | null;
  match_status: string;
  matched_stage: string | null;
  decision: string;
  skip_reason: string | null;
}

interface Progress {
  status: string; total: number; sent: number; errors: number; pending: number;
  intervalSeconds: number; etaSeconds: number | null;
  perInstance: Array<{ instanceId: string; name: string; sent: number; errors: number; connected: boolean }>;
}

interface ChurchOption { id: string; name: string }

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function normalizeHeader(h: string): string {
  return String(h ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    const hit = headers.find(h => !used.has(h) && (field.aliases as readonly string[]).includes(normalizeHeader(h)));
    if (hit) { mapping[field.key] = hit; used.add(hit); }
  }
  return mapping;
}

function fmtDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

const MATCH_LABEL: Record<string, string> = {
  new: 'Novo contato',
  member: 'Já é membro',
  pipeline: 'Já está no pipeline',
  both: 'Membro e no pipeline',
  invalid: 'Telefone inválido',
  duplicate_in_file: 'Repetido no arquivo',
};

/** Baixa o arquivo-modelo com as colunas que o sistema aceita. */
export function downloadTemplate() {
  exportRows(
    [{
      nome: 'Maria da Silva',
      telefone: '(19) 99999-8888',
      email: 'maria@email.com',
      igreja: 'AD Campinas - SEDE',
      regional: 'Campinas',
      tipo: 'followup',
      rol: '',
      cargo: '',
      observacao: 'Contato do evento de domingo',
    }],
    'modelo-importacao-contatos',
    'csv'
  );
}

export default function ImportCsvModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);

  // fase 1 — arquivo
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, string>>>([]);
  const [dragOver, setDragOver] = useState(false);

  // fase 2 — mapeamento e de-para
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [includeMembers, setIncludeMembers] = useState(false);
  const [includePipeline, setIncludePipeline] = useState(false);

  // fase 3 — mensagem e envio
  const [message, setMessage] = useState('Olá {{primeiro_nome}}, ');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [intervalSec, setIntervalSec] = useState(5);
  const [attendanceType, setAttendanceType] = useState<string>('followup');
  const [churchId, setChurchId] = useState('');
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const { instances, isLoading: loadingInstances } = useWhatsAppInstances();
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());

  // envio em andamento
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [starting, setStarting] = useState(false);
  // `looping` espelha o ref para a UI: o ref controla o loop, o state renderiza
  const [looping, setLooping] = useState(false);
  const loopActive = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/churches', { headers: authHeaders() });
        if (res.ok) {
          const list: ChurchOption[] = await res.json();
          setChurches(list);
          const mine = JSON.parse(localStorage.getItem('mrm_user') || '{}').churchId;
          if (mine && list.some(c => c.id === mine)) setChurchId(mine);
        }
      } catch { /* usuário escolhe manualmente */ }
    })();
    return () => { loopActive.current = false; };
  }, []);

  // ── fase 1: leitura do arquivo ────────────────────────────────────────────
  const readFile = async (file: File) => {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '', raw: false });
      if (!parsed.length) { setError('O arquivo não tem linhas de dados.'); return; }

      const cols = Object.keys(parsed[0]);
      setFilename(file.name);
      setHeaders(cols);
      setRawRows(parsed);
      setMapping(autoMap(cols));
      setSummary(null);
      setBatchId(null);
      setStep(2);
    } catch {
      setError('Não foi possível ler o arquivo. Use CSV ou Excel (.xlsx).');
    }
  };

  // ── fase 2: análise (de-para) ─────────────────────────────────────────────
  const analyze = async () => {
    if (!mapping.nome || !mapping.telefone) {
      setError('Mapeie ao menos as colunas de Nome e Telefone.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp/imports', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ filename, mapping, rows: rawRows, includeMembers, includePipeline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha na análise');
      setBatchId(data.batch.id);
      setSummary(data.summary);
      setRows(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na análise');
    } finally {
      setAnalyzing(false);
    }
  };

  // reavalia quem entra no envio quando o usuário muda os "enviar mesmo assim"
  const updateDecisions = async (nextMembers: boolean, nextPipeline: boolean) => {
    setIncludeMembers(nextMembers);
    setIncludePipeline(nextPipeline);
    if (!batchId) return;
    const res = await fetch(`/api/whatsapp/imports/${batchId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ includeMembers: nextMembers, includePipeline: nextPipeline }),
    });
    if (res.ok) {
      const data = await res.json();
      setSummary(data.summary);
      const refreshed = await fetch(`/api/whatsapp/imports/${batchId}`, { headers: authHeaders() });
      if (refreshed.ok) setRows((await refreshed.json()).rows ?? []);
    }
  };

  // ── fase 3: envio ─────────────────────────────────────────────────────────
  const refreshProgress = useCallback(async (id: string) => {
    const res = await fetch(`/api/whatsapp/campaigns/${id}`, { headers: authHeaders() });
    if (res.ok) setProgress((await res.json()).progress);
  }, []);

  const runLoop = useCallback(async (id: string) => {
    if (loopActive.current) return;
    loopActive.current = true;
    setLooping(true);
    while (loopActive.current) {
      try {
        const res = await fetch(`/api/whatsapp/campaigns/${id}/process`, {
          method: 'POST', headers: authHeaders(),
        });
        if (!res.ok) break;
        const tick = await res.json();
        setProgress(tick.progress);
        if (tick.done) break;
        await new Promise(r => setTimeout(r, Math.max(tick.waitMs ?? 1000, 300)));
      } catch {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    loopActive.current = false;
    setLooping(false);
    await refreshProgress(id);
  }, [refreshProgress]);

  const startSend = async () => {
    if (!batchId || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/whatsapp/imports/${batchId}/send`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          messageTemplate: message,
          intervalSeconds: Math.max(5, intervalSec),
          instanceIds: Array.from(selectedInstances),
          churchId,
          attendanceType,
          imageUrl: imageUrl.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar o envio');
      setCampaignId(data.campaign.id);
      await refreshProgress(data.campaign.id);
      runLoop(data.campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar o envio');
    } finally {
      setStarting(false);
    }
  };

  const patchCampaign = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!campaignId) return;
    if (action !== 'resume') { loopActive.current = false; setLooping(false); }
    const res = await fetch(`/api/whatsapp/campaigns/${campaignId}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setProgress((await res.json()).progress);
      if (action === 'resume') runLoop(campaignId);
    }
  };

  const insertVar = (variable: string) => {
    const el = messageRef.current;
    const token = `{{${variable}}}`;
    if (!el) { setMessage(m => m + token); return; }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    setMessage(message.slice(0, start) + token + message.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const connectedSelected = instances.filter(i => selectedInstances.has(i.id) && i.status === 'connected');
  const canStart = !!batchId && !!summary?.sendable && !!message.trim() && !!connectedSelected.length && !!churchId;
  const isRunning = progress?.status === 'running' && looping;
  const finished = progress?.status === 'completed' || progress?.status === 'cancelled';

  const previewVars = useMemo(() => {
    const first = rows.find(r => r.decision === 'send');
    const name = first?.name ?? 'Maria da Silva';
    return { nome: name, primeiro_nome: name.split(/\s+/)[0] ?? '', telefone: first?.phone ?? '' } as Record<string, string>;
  }, [rows]);

  const skipped = rows.filter(r => r.decision === 'skip');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={() => { if (!isRunning) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* cabeçalho + trilha das 3 fases */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <div className="font-semibold text-slate-800">Importar contatos e enviar em massa</div>
          <div className="ml-auto flex items-center gap-1.5">
            {([1, 2, 3] as const).map(n => (
              <div key={n} className={`h-1.5 rounded-full transition-all ${
                step === n ? 'w-8 bg-emerald-500' : step > n ? 'w-5 bg-emerald-200' : 'w-5 bg-slate-200'
              }`} />
            ))}
          </div>
          <button onClick={onClose} disabled={isRunning}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── FASE 1: arquivo ── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) readFile(file);
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors
                  ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}
              >
                <Upload className="w-8 h-8 text-slate-400" />
                <div className="font-medium text-slate-700">Arraste o arquivo aqui ou clique para escolher</div>
                <div className="text-xs text-slate-400">Formatos aceitos: CSV e Excel (.xlsx) — até 5.000 linhas</div>
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
              </label>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
                <Download className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="text-sm text-slate-600 flex-1">
                  Não sabe o formato? Baixe o <b>modelo</b> com as colunas que o sistema aceita
                  (<span className="font-mono text-xs">nome, telefone, email, igreja, regional, tipo, rol, cargo, observacao</span>).
                  Só <b>nome</b> e <b>telefone</b> são obrigatórios.
                </div>
                <button onClick={downloadTemplate}
                  className="h-9 px-3 rounded-lg bg-slate-800 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-700 flex-shrink-0">
                  <Download className="w-4 h-4" /> Baixar modelo
                </button>
              </div>
            </div>
          )}

          {/* ── FASE 2: mapeamento + resumo ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="text-sm text-slate-500">
                <b className="text-slate-700">{filename}</b> · {rawRows.length} linha{rawRows.length === 1 ? '' : 's'} lida{rawRows.length === 1 ? '' : 's'}.
                Confira o de-para das colunas — o que estiver mapeado alimenta as variáveis da mensagem.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {IMPORT_FIELDS.map(f => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                      <span className="ml-1 font-mono text-[10px] text-slate-400">{`{{${f.key}}}`}</span>
                    </label>
                    <select
                      value={mapping[f.key] ?? ''}
                      onChange={e => {
                        setMapping(m => ({ ...m, [f.key]: e.target.value }));
                        setSummary(null);
                        setBatchId(null);
                      }}
                      className={`h-9 px-2 rounded-lg border text-sm bg-white
                        ${f.required && !mapping[f.key] ? 'border-red-300' : 'border-slate-200'}`}>
                      <option value="">— não usar —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {!summary && (
                <button onClick={analyze} disabled={analyzing}
                  className="h-10 rounded-lg bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-700 disabled:opacity-50">
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Analisar arquivo
                </button>
              )}

              {summary && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <SummaryCard icon={<Users className="w-3 h-3" />} tone="slate" label="Linhas" value={summary.total} />
                    <SummaryCard icon={<CheckCircle2 className="w-3 h-3" />} tone="emerald" label="Novos" value={summary.new} />
                    <SummaryCard icon={<UserCheck className="w-3 h-3" />} tone="blue" label="Já membros" value={summary.member + summary.both} />
                    <SummaryCard icon={<LayoutGrid className="w-3 h-3" />} tone="violet" label="No pipeline" value={summary.pipeline + summary.both} />
                    <SummaryCard icon={<Ban className="w-3 h-3" />} tone="amber" label="Repetidos" value={summary.duplicate} />
                    <SummaryCard icon={<AlertTriangle className="w-3 h-3" />} tone="red" label="Inválidos" value={summary.invalid} />
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
                    <div className="text-sm font-semibold text-slate-700">Quem vai receber</div>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={includeMembers}
                        onChange={e => updateDecisions(e.target.checked, includePipeline)}
                        className="w-4 h-4 rounded border-slate-300" />
                      Enviar também para quem <b>já é membro</b> ({summary.member + summary.both})
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={includePipeline}
                        onChange={e => updateDecisions(includeMembers, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300" />
                      Enviar também para quem <b>já está no pipeline</b> ({summary.pipeline + summary.both})
                    </label>
                    <div className="text-xs text-slate-400">
                      Telefones inválidos e números repetidos no arquivo nunca são enviados.
                    </div>
                    <div className="mt-1 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700 font-semibold">
                      {summary.sendable} contato{summary.sendable === 1 ? '' : 's'} receberá{summary.sendable === 1 ? '' : 'ão'} a mensagem
                      <span className="font-normal text-emerald-600"> · {summary.skipped} fora do envio (motivo registrado na aba Importações)</span>
                    </div>
                  </div>

                  {skipped.length > 0 && (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                        Não serão enviados ({skipped.length})
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
                        {skipped.slice(0, 100).map(r => (
                          <div key={r.id} className="px-3 py-1.5 flex items-center gap-2 text-sm">
                            <span className="text-slate-400 text-xs w-8">#{r.row_number}</span>
                            <span className="font-medium text-slate-700 truncate flex-1">{r.name || '—'}</span>
                            <span className="text-xs text-slate-400">{r.phone ?? 'sem telefone'}</span>
                            <span className="text-xs text-amber-600 font-medium">
                              {MATCH_LABEL[r.match_status] ?? r.match_status}
                              {r.matched_stage ? ` · ${r.matched_stage}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── FASE 3: mensagem + envio ── */}
          {step === 3 && (
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 flex flex-col gap-3">
                <div className="text-sm font-semibold text-slate-700">Mensagem</div>
                <textarea
                  ref={messageRef}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={6}
                  disabled={!!campaignId}
                  placeholder="Olá {{primeiro_nome}}, ..."
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-50"
                />
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARS.map(v => (
                    <button key={v}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('text/plain', `{{${v}}}`)}
                      onClick={() => insertVar(v)}
                      disabled={!!campaignId}
                      title="Clique para inserir no cursor — ou arraste para dentro da mensagem"
                      className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 font-mono cursor-grab active:cursor-grabbing disabled:opacity-40">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-slate-400">
                  Arraste uma variável para dentro do texto ou clique para inserir onde o cursor está.
                  Elas são preenchidas com os dados do arquivo, contato a contato.
                </div>

                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} disabled={!!campaignId}
                    placeholder="URL da imagem (enviada em anexo)"
                    className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-xs disabled:bg-slate-50" />
                </div>
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} disabled={!!campaignId}
                    placeholder="Link (ex.: vídeo) anexado ao final"
                    className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-xs disabled:bg-slate-50" />
                </div>

                {message.trim() && (
                  <div className="text-xs bg-slate-50 rounded-lg p-2 text-slate-600 border border-slate-100 whitespace-pre-wrap">
                    <span className="font-semibold text-slate-400 block mb-0.5">Prévia · {previewVars.nome}</span>
                    {message.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => previewVars[k] ?? `⟦${k}⟧`)}
                  </div>
                )}
              </div>

              <div className="w-full lg:w-[300px] flex flex-col gap-3 flex-shrink-0">
                {/* card de acompanhamento */}
                <div className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
                  <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-slate-400" /> Card no pipeline
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Cada envio cria um card na coluna <b>FAZENDO</b> para acompanhamento.
                  </div>
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <Church className="w-3 h-3" /> Igreja
                  </label>
                  <select value={churchId} onChange={e => setChurchId(e.target.value)} disabled={!!campaignId}
                    className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white disabled:bg-slate-50">
                    <option value="">Selecione a igreja...</option>
                    {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <label className="text-xs font-medium text-slate-500">Categoria do atendimento</label>
                  <select value={attendanceType} onChange={e => setAttendanceType(e.target.value)} disabled={!!campaignId}
                    className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white disabled:bg-slate-50">
                    {(Object.entries(ATTENDANCE_TYPE_LABELS) as Array<[AttendanceType, string]>).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-400">
                    Se a coluna <span className="font-mono">tipo</span> vier preenchida no arquivo, ela tem prioridade.
                  </div>
                </div>

                {/* instâncias + intervalo */}
                <div className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
                  <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-slate-400" /> Instâncias
                  </div>
                  {loadingInstances && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  {!loadingInstances && !instances.length && (
                    <div className="text-xs text-slate-400">Nenhuma instância cadastrada.</div>
                  )}
                  {instances.map(inst => {
                    const connected = inst.status === 'connected';
                    return (
                      <label key={inst.id}
                        className={`flex items-center gap-2 text-sm rounded-lg border px-2 py-1.5
                          ${connected ? 'border-slate-200 cursor-pointer hover:bg-slate-50' : 'border-slate-100 opacity-50'}`}>
                        <input type="checkbox" disabled={!connected || !!campaignId}
                          checked={selectedInstances.has(inst.id)}
                          onChange={() => setSelectedInstances(prev => {
                            const next = new Set(prev);
                            if (next.has(inst.id)) next.delete(inst.id); else next.add(inst.id);
                            return next;
                          })}
                          className="w-4 h-4 rounded border-slate-300" />
                        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        <span className="font-medium text-slate-700 truncate">{inst.name}</span>
                      </label>
                    );
                  })}

                  <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                    <Timer className="w-4 h-4 text-slate-400" />
                    Intervalo:
                    <input type="number" min={5} max={600} value={intervalSec} disabled={!!campaignId}
                      onChange={e => setIntervalSec(Number(e.target.value) || 5)}
                      onBlur={() => setIntervalSec(v => Math.max(5, v))}
                      className="w-16 h-7 px-1.5 rounded-lg border border-slate-200 text-xs text-center disabled:bg-slate-50" />
                    s por instância
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Mínimo de 5 s — proteção contra bloqueio.
                    {selectedInstances.size > 1 && ` Os envios se alternam entre as ${selectedInstances.size} instâncias, e nenhuma envia antes do intervalo dela.`}
                  </div>
                </div>

                {/* progresso */}
                {progress && (
                  <div className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
                    <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      {isRunning ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {progress.status === 'running' ? 'Enviando...' :
                        progress.status === 'completed' ? 'Envio concluído' :
                        progress.status === 'paused' ? 'Pausado' :
                        progress.status === 'cancelled' ? 'Cancelado' : progress.status}
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${progress.total ? ((progress.sent + progress.errors) / progress.total) * 100 : 0}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-[10px] uppercase text-emerald-500 font-semibold">Enviadas</div><div className="text-lg font-bold text-emerald-700">{progress.sent}</div></div>
                      <div><div className="text-[10px] uppercase text-amber-500 font-semibold">Pendentes</div><div className="text-lg font-bold text-amber-700">{progress.pending}</div></div>
                      <div><div className="text-[10px] uppercase text-red-500 font-semibold">Erros</div><div className="text-lg font-bold text-red-700">{progress.errors}</div></div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600">
                      <Hourglass className="w-3.5 h-3.5" />
                      {progress.status === 'running' && progress.etaSeconds != null
                        ? `Tempo restante ~${fmtDuration(progress.etaSeconds)}`
                        : progress.pending === 0 ? 'Concluído' : '—'}
                    </div>
                    {!finished && (
                      <div className="flex gap-2">
                        {isRunning ? (
                          <button onClick={() => patchCampaign('pause')}
                            className="flex-1 h-8 rounded-lg bg-amber-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-amber-400">
                            <Pause className="w-3.5 h-3.5" /> Pausar
                          </button>
                        ) : (
                          <button onClick={() => patchCampaign('resume')}
                            className="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-emerald-500">
                            <Play className="w-3.5 h-3.5" /> Retomar
                          </button>
                        )}
                        <button onClick={() => patchCampaign('cancel')}
                          className="h-8 px-2.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-red-50">
                          <Square className="w-3.5 h-3.5" /> Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* rodapé — navegação entre as fases */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
          {step > 1 && !campaignId && (
            <button onClick={() => { setStep(s => (s === 3 ? 2 : 1) as 1 | 2 | 3); setError(null); }}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 inline-flex items-center gap-1.5 hover:bg-slate-50">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {step === 2 && (
              <button onClick={() => setStep(3)} disabled={!summary?.sendable}
                title={!summary ? 'Analise o arquivo primeiro' : !summary.sendable ? 'Nenhum contato elegível para envio' : undefined}
                className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-emerald-500 disabled:opacity-50">
                Escrever mensagem <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && !campaignId && (
              <button onClick={startSend} disabled={!canStart || starting}
                title={!churchId ? 'Selecione a igreja dos cards' : !connectedSelected.length ? 'Selecione ao menos uma instância conectada' : undefined}
                className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-emerald-500 disabled:opacity-50">
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Iniciar envio ({summary?.sendable ?? 0})
              </button>
            )}
            {campaignId && finished && (
              <button onClick={onClose}
                className="h-9 px-4 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700">
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: number;
  tone: 'slate' | 'emerald' | 'blue' | 'violet' | 'amber' | 'red';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-500 [&_b]:text-slate-800',
    emerald: 'bg-emerald-50 text-emerald-500 [&_b]:text-emerald-700',
    blue: 'bg-blue-50 text-blue-500 [&_b]:text-blue-700',
    violet: 'bg-violet-50 text-violet-500 [&_b]:text-violet-700',
    amber: 'bg-amber-50 text-amber-500 [&_b]:text-amber-700',
    red: 'bg-red-50 text-red-500 [&_b]:text-red-700',
  };
  return (
    <div className={`rounded-lg p-2.5 ${tones[tone]}`}>
      <div className="text-[11px] uppercase font-semibold flex items-center gap-1">{icon} {label}</div>
      <b className="text-xl font-bold block">{value}</b>
    </div>
  );
}
