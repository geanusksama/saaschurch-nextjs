import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import { exportRows } from '../pastoral/exportUtils';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

type Row = Record<string, string>;
type Step = 'upload' | 'preview' | 'importing' | 'done';

const TEMPLATE_COLUMNS = ['nome', 'categoria', 'setor', 'descricao', 'tipo_local', 'local_detalhe', 'tipo_aquisicao', 'data_aquisicao', 'valor'];

const COLUMN_MAP: Record<string, string> = {
  nome: 'name', categoria: 'category', setor: 'sector', descricao: 'description',
  tipo_local: 'locationType', local_detalhe: 'locationDetail',
  tipo_aquisicao: 'acquisitionType', data_aquisicao: 'acquisitionDate', valor: 'value',
};

export function AssetImportModal({ onClose, onImported }: Props) {
  const token = localStorage.getItem('mrm_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: number; errors: Array<{ row: number; message: string }> } | null>(null);

  function downloadTemplate() {
    exportRows(
      [{ nome: 'Cadeira plástica branca', categoria: 'Mobiliário', setor: 'Louvor', descricao: '', tipo_local: 'SALA', local_detalhe: 'Sala 3', tipo_aquisicao: 'COMPRA', data_aquisicao: '2026-01-15', valor: '35.00' }],
      'modelo-importacao-patrimonio',
      'csv'
    );
  }

  async function handleFile(f: File | null) {
    setFile(f);
    setError(null);
    if (!f) return;
    try {
      const buffer = await f.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Row>(ws, { defval: '', raw: false });
      const mapped = raw.map((r) => {
        const out: Row = {};
        for (const [csvCol, value] of Object.entries(r)) {
          const key = COLUMN_MAP[csvCol.trim().toLowerCase()] || csvCol;
          out[key] = String(value ?? '').trim();
        }
        return out;
      });
      setRows(mapped);
      setStep('preview');
    } catch {
      setError('Não foi possível ler o arquivo. Use o modelo de planilha fornecido.');
    }
  }

  async function handleImport() {
    setStep('importing');
    setError(null);
    try {
      const res = await fetch(`${apiBase}/assets/import-csv/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ records: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na importação.');
      setResult(data);
      setStep('done');
      if (data.success > 0) toast.success(`${data.success} bem(ns) importado(s)!`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message || 'Erro ao importar.');
      setStep('preview');
    }
  }

  const invalidCount = rows.filter((r) => !r.name).length;
  const willImport = rows.length - invalidCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Importar Patrimônio via CSV</h2>
              <p className="text-sm text-slate-500">Cadastro em lote de bens a partir de uma planilha</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Download className="w-4 h-4" /> Baixar modelo de planilha
              </button>

              <div
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-amber-400 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0] || null); }}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-green-600" />
                    <p className="font-semibold">{file.name}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Arraste ou clique para selecionar a planilha</p>
                    <p className="text-sm text-slate-400 mt-1">.csv, .xlsx ou .xls — use o modelo acima</p>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-2xl font-bold">{rows.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Linhas no arquivo</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-200 dark:border-green-900 text-center">
                  <p className="text-2xl font-bold text-green-700">{willImport}</p>
                  <p className="text-xs text-green-600 mt-1">Serão importados</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-200 dark:border-red-900 text-center">
                  <p className="text-2xl font-bold text-red-700">{invalidCount}</p>
                  <p className="text-xs text-red-600 mt-1">Sem nome (ignorados)</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg max-h-64">
                <table className="text-xs w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>{TEMPLATE_COLUMNS.map((c) => <th key={c} className="p-2 text-left font-semibold">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        {TEMPLATE_COLUMNS.map((c) => <td key={c} className="p-2">{r[COLUMN_MAP[c]] || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStep('upload')} className="text-sm text-slate-500 hover:text-slate-800">← Trocar arquivo</button>
                <button
                  onClick={handleImport}
                  disabled={willImport === 0}
                  className="flex items-center gap-2 bg-amber-600 text-white px-6 py-2.5 rounded-lg hover:bg-amber-700 font-semibold disabled:opacity-50"
                >
                  <Package className="w-4 h-4" /> Confirmar e importar {willImport}
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">Importando bens...</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <h3 className="text-lg font-bold">Importação concluída!</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-200 dark:border-green-900">
                  <p className="text-2xl font-bold text-green-700">{result.success}</p>
                  <p className="text-xs text-green-600 mt-1">Bens criados</p>
                </div>
                <div className="text-center bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-200 dark:border-red-900">
                  <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                  <p className="text-xs text-red-600 mt-1">Erros</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <details className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                  <summary className="text-sm font-semibold text-red-700 cursor-pointer">Ver erros</summary>
                  <ul className="mt-2 text-xs space-y-1">
                    {result.errors.map((e, i) => <li key={i}>Linha {e.row || '—'}: {e.message}</li>)}
                  </ul>
                </details>
              )}
              <div className="flex justify-end">
                <button onClick={onImported} className="px-6 py-2.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700">Concluir</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
