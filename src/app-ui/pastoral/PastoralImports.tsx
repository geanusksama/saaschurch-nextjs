/**
 * Importações — consulta dos lotes de contatos importados por CSV/Excel.
 *
 * Cada lote abre o de-para completo: linha a linha do arquivo, o que foi
 * enviado e o que ficou de fora com o motivo (já é membro, já está no pipeline
 * e em qual fase, telefone inválido, número repetido). Exportável em CSV/Excel.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet, Loader2, RefreshCw, ArrowLeft, CheckCircle2, XCircle,
  Clock, Download, Search,
} from 'lucide-react';
import { exportRows } from './exportUtils';

interface Batch {
  id: string;
  filename: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  member_rows: number;
  pipeline_rows: number;
  new_rows: number;
  status: string;
  campaign_id: string | null;
  created_at: string;
}

interface ImportRow {
  id: string;
  row_number: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  match_status: string;
  matched_stage: string | null;
  decision: string;
  skip_reason: string | null;
  send_status: string | null;
  sent_at: string | null;
  send_error: string | null;
  created_attendance_id: string | null;
}

const MATCH_LABEL: Record<string, string> = {
  new: 'Novo contato',
  member: 'Já é membro',
  pipeline: 'Já está no pipeline',
  both: 'Membro e no pipeline',
  invalid: 'Telefone inválido',
  duplicate_in_file: 'Repetido no arquivo',
};

const BATCH_STATUS: Record<string, string> = {
  analyzed: 'Analisado (sem envio)',
  sending: 'Enviando',
  sent: 'Enviado',
  cancelled: 'Cancelado',
};

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function fmtPhone(phone: string | null): string {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return phone ?? '—';
}

export default function PastoralImports() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [openBatch, setOpenBatch] = useState<Batch | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sent' | 'skipped'>('all');
  const [q, setQ] = useState('');

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/imports', { headers: authHeaders() });
      if (res.ok) setBatches((await res.json()).batches ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  // carga inicial da lista de lotes (mesmo padrão das outras abas do hub)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadBatches(); }, [loadBatches]);

  const openDetail = async (batch: Batch) => {
    setOpenBatch(batch);
    setRows([]);
    setFilter('all');
    setQ('');
    setLoadingRows(true);
    try {
      const res = await fetch(`/api/whatsapp/imports/${batch.id}`, { headers: authHeaders() });
      if (res.ok) setRows((await res.json()).rows ?? []);
    } finally {
      setLoadingRows(false);
    }
  };

  const visibleRows = rows.filter(r => {
    if (filter === 'sent' && r.send_status !== 'sent') return false;
    if (filter === 'skipped' && r.decision !== 'skip') return false;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const digits = needle.replace(/\D/g, '');
      const hitName = (r.name ?? '').toLowerCase().includes(needle);
      const hitPhone = !!digits && (r.phone ?? '').includes(digits);
      if (!hitName && !hitPhone) return false;
    }
    return true;
  });

  const exportDetail = (format: 'csv' | 'xlsx') => {
    exportRows(
      visibleRows.map(r => ({
        Linha: r.row_number,
        Nome: r.name ?? '',
        Telefone: fmtPhone(r.phone),
        'E-mail': r.email ?? '',
        Situação: MATCH_LABEL[r.match_status] ?? r.match_status,
        'Fase no pipeline': r.matched_stage ?? '',
        Enviado: r.send_status === 'sent' ? 'Sim' : 'Não',
        'Motivo (não enviado)': r.send_error ?? r.skip_reason ?? '',
        'Enviado em': r.sent_at ? new Date(r.sent_at).toLocaleString('pt-BR') : '',
        'Card criado': r.created_attendance_id ? 'Sim' : 'Não',
      })),
      `importacao-${(openBatch?.filename ?? 'lote').replace(/\.[^.]+$/, '')}`,
      format
    );
  };

  // ── detalhe do lote (de-para) ──────────────────────────────────────────────
  if (openBatch) {
    const sentCount = rows.filter(r => r.send_status === 'sent').length;
    const skippedCount = rows.filter(r => r.decision === 'skip').length;

    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setOpenBatch(null)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 inline-flex items-center gap-1.5 hover:bg-slate-50">
            <ArrowLeft className="w-4 h-4" /> Lotes
          </button>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 truncate">{openBatch.filename ?? 'Arquivo importado'}</div>
            <div className="text-xs text-slate-400">
              {new Date(openBatch.created_at).toLocaleString('pt-BR')} · {BATCH_STATUS[openBatch.status] ?? openBatch.status}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {(['all', 'sent', 'skipped'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors
                  ${filter === f ? 'bg-slate-800 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {f === 'all' ? `Todos (${rows.length})` : f === 'sent' ? `Enviados (${sentCount})` : `Não enviados (${skippedCount})`}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome ou telefone..."
              className="h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-sm w-48" />
          </div>
          <button onClick={() => exportDetail('csv')} disabled={!visibleRows.length}
            className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-30">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => exportDetail('xlsx')} disabled={!visibleRows.length}
            className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-30">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-auto">
          {loadingRows && <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
          {!loadingRows && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Contato</th>
                  <th className="px-3 py-2 text-left font-semibold">Telefone</th>
                  <th className="px-3 py-2 text-left font-semibold">Situação na base</th>
                  <th className="px-3 py-2 text-left font-semibold">Envio</th>
                  <th className="px-3 py-2 text-left font-semibold">Motivo / Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibleRows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-400">{r.row_number}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{r.name || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{fmtPhone(r.phone)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded
                        ${r.match_status === 'new' ? 'bg-emerald-50 text-emerald-600'
                          : r.match_status === 'member' ? 'bg-blue-50 text-blue-600'
                          : r.match_status === 'pipeline' || r.match_status === 'both' ? 'bg-violet-50 text-violet-600'
                          : 'bg-slate-100 text-slate-500'}`}>
                        {MATCH_LABEL[r.match_status] ?? r.match_status}
                      </span>
                      {r.matched_stage && (
                        <span className="ml-1.5 text-xs text-slate-400">fase: {r.matched_stage}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.send_status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Enviado
                        </span>
                      ) : r.send_status === 'error' ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium text-xs">
                          <XCircle className="w-3.5 h-3.5" /> Erro
                        </span>
                      ) : r.decision === 'skip' ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-xs">
                          <XCircle className="w-3.5 h-3.5" /> Não enviado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-xs">
                          <Clock className="w-3.5 h-3.5" /> Aguardando
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {r.send_error ?? r.skip_reason ??
                        (r.sent_at ? new Date(r.sent_at).toLocaleString('pt-BR') : '—')}
                      {r.created_attendance_id && (
                        <span className="ml-1.5 text-[11px] text-violet-500">· card criado</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!visibleRows.length && (
                  <tr><td colSpan={6} className="p-8 text-center text-sm text-slate-400">Nenhuma linha para este filtro.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ── lista de lotes ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-slate-400" />
        <span className="font-semibold text-slate-700 text-sm">
          {batches.length} lote{batches.length === 1 ? '' : 's'} importado{batches.length === 1 ? '' : 's'}
        </span>
        <button onClick={loadBatches} className="ml-auto p-1.5 rounded hover:bg-slate-100">
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-auto">
        {loading && <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
        {!loading && !batches.length && (
          <div className="p-10 text-center text-sm text-slate-400">
            Nenhuma importação ainda. Use o botão <b>Importar CSV</b> na aba Envio em Massa.
          </div>
        )}
        {!loading && batches.map(b => (
          <button key={b.id} onClick={() => openDetail(b)}
            className="w-full px-4 py-3 flex flex-wrap items-center gap-3 text-left border-b border-slate-50 hover:bg-slate-50">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-700 truncate">{b.filename ?? 'Arquivo importado'}</div>
              <div className="text-xs text-slate-400">{new Date(b.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{b.total_rows} linhas</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">{b.valid_rows} enviáveis</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{b.member_rows} membros</span>
              <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">{b.pipeline_rows} no pipeline</span>
              {b.invalid_rows > 0 && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600">{b.invalid_rows} inválidos</span>}
              {b.duplicate_rows > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{b.duplicate_rows} repetidos</span>}
            </div>
            <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded flex-shrink-0
              ${b.status === 'sent' ? 'bg-emerald-50 text-emerald-600'
                : b.status === 'sending' ? 'bg-blue-50 text-blue-600'
                : 'bg-slate-100 text-slate-500'}`}>
              {BATCH_STATUS[b.status] ?? b.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
