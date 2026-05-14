import {
  Upload, Download, FileText, Users, Check, X, AlertTriangle,
  ChevronRight, ChevronLeft, RefreshCw, Eye, Table2, Building2, Droplets,
  Star, ArrowRightLeft, BookOpen, DatabaseZap,
} from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { apiBase } from '../../../lib/apiBase';

// ─── Templates definitions ───────────────────────────────────────────────────

type FieldDef = { key: string; label: string; required?: boolean; hint?: string };

type EntityTemplate = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  endpoint: string;
  fields: FieldDef[];
};

const TEMPLATES: EntityTemplate[] = [
  {
    id: 'members',
    label: 'Membros',
    icon: Users,
    color: 'purple',
    endpoint: '/import/members',
    fields: [
      { key: 'fullName', label: 'Nome Completo', required: true },
      { key: 'preferredName', label: 'Nome Preferido' },
      { key: 'cpf', label: 'CPF', hint: '000.000.000-00' },
      { key: 'rg', label: 'RG' },
      { key: 'birthDate', label: 'Data de Nascimento', hint: 'AAAA-MM-DD' },
      { key: 'gender', label: 'Gênero', hint: 'MASCULINO | FEMININO' },
      { key: 'maritalStatus', label: 'Estado Civil', hint: 'SOLTEIRO | CASADO | VIUVO | DIVORCIADO' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Telefone' },
      { key: 'mobile', label: 'Celular' },
      { key: 'addressStreet', label: 'Endereço (Rua)' },
      { key: 'addressNumber', label: 'Número' },
      { key: 'addressComplement', label: 'Complemento' },
      { key: 'addressNeighborhood', label: 'Bairro' },
      { key: 'addressCity', label: 'Cidade' },
      { key: 'addressState', label: 'Estado (UF)' },
      { key: 'addressZipcode', label: 'CEP' },
      { key: 'membershipStatus', label: 'Status de Membro', hint: 'ATIVO | INATIVO | AGUARDANDO ATIVACAO' },
      { key: 'membershipDate', label: 'Data de Membresia', hint: 'AAAA-MM-DD' },
      { key: 'ecclesiasticalTitle', label: 'Título Eclesiástico', hint: 'CONGREGADO | MEMBRO | DIACONO | PRESBITERO | EVANGELISTA | PASTOR' },
      { key: 'baptismStatus', label: 'Status Batismo', hint: 'NAO_BATIZADO | BATIZADO' },
      { key: 'baptismDate', label: 'Data de Batismo', hint: 'AAAA-MM-DD' },
      { key: 'fatherName', label: 'Nome do Pai' },
      { key: 'motherName', label: 'Nome da Mãe' },
      { key: 'spouseName', label: 'Nome do Cônjuge' },
      { key: 'occupation', label: 'Profissão' },
      { key: 'naturalityCity', label: 'Cidade Natal' },
      { key: 'naturalityState', label: 'Estado Natal (UF)' },
      { key: 'notes', label: 'Observações' },
      { key: 'emergencyContactName', label: 'Contato Emergência - Nome' },
      { key: 'emergencyContactPhone', label: 'Contato Emergência - Tel' },
    ],
  },
  {
    id: 'churches',
    label: 'Igrejas',
    icon: Building2,
    color: 'blue',
    endpoint: '/import/churches',
    fields: [
      { key: 'name', label: 'Nome', required: true },
      { key: 'code', label: 'Código', required: true },
      { key: 'legalName', label: 'Razão Social' },
      { key: 'cnpj', label: 'CNPJ' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Telefone' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'website', label: 'Site' },
      { key: 'addressStreet', label: 'Endereço (Rua)' },
      { key: 'addressNumber', label: 'Número' },
      { key: 'addressComplement', label: 'Complemento' },
      { key: 'addressNeighborhood', label: 'Bairro' },
      { key: 'addressCity', label: 'Cidade' },
      { key: 'addressState', label: 'Estado (UF)' },
      { key: 'addressZipcode', label: 'CEP' },
      { key: 'hasOwnTemple', label: 'Templo Próprio', hint: 'true | false' },
      { key: 'notes', label: 'Observações' },
    ],
  },
  {
    id: 'baptisms',
    label: 'Batismos',
    icon: Droplets,
    color: 'cyan',
    endpoint: '/import/baptisms',
    fields: [
      { key: 'memberName', label: 'Nome do Membro', required: true },
      { key: 'memberCpf', label: 'CPF do Membro' },
      { key: 'baptismDate', label: 'Data do Batismo', required: true, hint: 'AAAA-MM-DD' },
      { key: 'location', label: 'Local' },
      { key: 'ministerName', label: 'Nome do Ministro' },
      { key: 'notes', label: 'Observações' },
    ],
  },
  {
    id: 'consecrations',
    label: 'Consagrações',
    icon: Star,
    color: 'yellow',
    endpoint: '/import/consecrations',
    fields: [
      { key: 'childName', label: 'Nome da Criança', required: true },
      { key: 'birthDate', label: 'Data de Nascimento', required: true, hint: 'AAAA-MM-DD' },
      { key: 'consecrationDate', label: 'Data da Consagração', required: true, hint: 'AAAA-MM-DD' },
      { key: 'fatherName', label: 'Nome do Pai' },
      { key: 'motherName', label: 'Nome da Mãe' },
      { key: 'ministerName', label: 'Nome do Ministro' },
      { key: 'location', label: 'Local' },
      { key: 'notes', label: 'Observações' },
    ],
  },
  {
    id: 'transfers',
    label: 'Transferências',
    icon: ArrowRightLeft,
    color: 'green',
    endpoint: '/import/transfers',
    fields: [
      { key: 'memberName', label: 'Nome do Membro', required: true },
      { key: 'memberCpf', label: 'CPF do Membro' },
      { key: 'originChurch', label: 'Igreja de Origem', required: true },
      { key: 'destinationChurch', label: 'Igreja de Destino', required: true },
      { key: 'transferDate', label: 'Data da Transferência', required: true, hint: 'AAAA-MM-DD' },
      { key: 'reason', label: 'Motivo' },
      { key: 'notes', label: 'Observações' },
    ],
  },
  {
    id: 'titleHistory',
    label: 'Histórico de Títulos',
    icon: BookOpen,
    color: 'orange',
    endpoint: '/import/title-history',
    fields: [
      { key: 'memberName', label: 'Nome do Membro', required: true },
      { key: 'memberCpf', label: 'CPF do Membro' },
      { key: 'title', label: 'Título', required: true, hint: 'DIACONO | PRESBITERO | EVANGELISTA | PASTOR' },
      { key: 'startDate', label: 'Data de Início', required: true, hint: 'AAAA-MM-DD' },
      { key: 'endDate', label: 'Data de Encerramento', hint: 'AAAA-MM-DD' },
      { key: 'ordainedBy', label: 'Ordenado por' },
      { key: 'location', label: 'Local' },
      { key: 'notes', label: 'Observações' },
    ],
  },
];

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function buildCSV(fields: FieldDef[]): string {
  const headers = fields.map(f => f.key).join(',');
  const hints = fields.map(f => f.hint ? `"${f.hint}"` : '').join(',');
  return `${headers}\n${hints}\n`;
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function autoMapFields(csvHeaders: string[], dbFields: FieldDef[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  csvHeaders.forEach(h => {
    const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = dbFields.find(f => {
      const fNorm = f.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const lNorm = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      return fNorm === norm || lNorm === norm;
    });
    mapping[h] = match ? match.key : '';
  });
  return mapping;
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Step = 'select' | 'upload' | 'mapping' | 'preview' | 'result';

type ImportResult = { success: number; errors: Array<{ row: number; message: string }> };

const colorMap: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-600',
  blue: 'bg-blue-100 text-blue-600',
  cyan: 'bg-cyan-100 text-cyan-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  green: 'bg-green-100 text-green-600',
  orange: 'bg-orange-100 text-orange-600',
};

const borderMap: Record<string, string> = {
  purple: 'border-purple-400 bg-purple-50',
  blue: 'border-blue-400 bg-blue-50',
  cyan: 'border-cyan-400 bg-cyan-50',
  yellow: 'border-yellow-400 bg-yellow-50',
  green: 'border-green-400 bg-green-50',
  orange: 'border-orange-400 bg-orange-50',
};

export function Import() {
  const [step, setStep] = useState<Step>('select');
  const [entity, setEntity] = useState<EntityTemplate | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('mrm_token');

  const reset = () => {
    setStep('select');
    setEntity(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setFileName('');
    setFieldMapping({});
    setResult(null);
  };

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      if (entity) {
        setFieldMapping(autoMapFields(headers, entity.fields));
      }
      setStep('mapping');
    };
    reader.readAsText(file, 'UTF-8');
  }, [entity]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const mappedRows = csvRows.map(row => {
    const obj: Record<string, string> = {};
    csvHeaders.forEach((h, i) => {
      const dbKey = fieldMapping[h];
      if (dbKey) obj[dbKey] = row[i] ?? '';
    });
    return obj;
  });

  const requiredFields = entity?.fields.filter(f => f.required).map(f => f.key) ?? [];
  const validRows = mappedRows.filter(row =>
    requiredFields.every(k => (row[k] ?? '').trim() !== '')
  );
  const invalidRows = mappedRows.length - validRows.length;

  const handleImport = async () => {
    if (!entity) return;
    setImporting(true);
    try {
      const res = await fetch(`${apiBase}${entity.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ records: validRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na importação');
      setResult(data);
      setStep('result');
    } catch (err: any) {
      setResult({ success: 0, errors: [{ row: 0, message: err.message }] });
      setStep('result');
    } finally {
      setImporting(false);
    }
  };

  // ── Step: Select entity ──
  if (step === 'select') return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Importação de Dados</h1>
        <p className="text-slate-600 dark:text-slate-400">Importe dados em massa via arquivo CSV</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: FileText, label: '1. Baixe o template', desc: 'Use o modelo CSV para formatar seus dados' },
          { icon: Upload, label: '2. Faça o upload', desc: 'Selecione ou arraste o arquivo preenchido' },
          { icon: Eye, label: '3. Revise e confirme', desc: 'Mapeie campos e valide antes de importar' },
        ].map((s, i) => (
          <div key={i} className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <s.icon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">{s.label}</p>
              <p className="text-xs text-slate-600 mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Legacy migration card */}
      <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <DatabaseZap className="w-6 h-6 text-green-700" />
          </div>
          <div>
            <h3 className="font-bold text-green-900">Migração do Banco Legado</h3>
            <p className="text-sm text-green-700 mt-0.5">Importe os arquivos <span className="font-mono font-semibold">membros.csv</span> e <span className="font-mono font-semibold">contatomembro.csv</span> do sistema antigo com mapeamento automático de campos, validação por rol e upsert seguro.</p>
          </div>
        </div>
        <Link
          to="/app-ui/members/import"
          className="flex-shrink-0 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-semibold transition-colors"
        >
          <Upload className="w-4 h-4" />
          Iniciar Migração
        </Link>
      </div>

      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Escolha o tipo de dados</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-purple-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[t.color]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900">{t.label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t.fields.length} campos disponíveis</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => downloadCSV(`template_${t.id}.csv`, buildCSV(t.fields))}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Template CSV
                </button>
                <button
                  onClick={() => { setEntity(t); setStep('upload'); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Importar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-orange-900 text-sm">Atenção antes de importar</p>
          <p className="text-xs text-orange-700 mt-1">Recomendamos fazer backup do banco de dados antes de importar grandes volumes de dados. Registros duplicados podem ser criados se os dados já existirem no sistema.</p>
        </div>
      </div>
    </div>
  );

  // ── Step: Upload file ──
  if (step === 'upload' && entity) {
    const Icon = entity.icon;
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={reset} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[entity.color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Importar {entity.label}</h1>
            <p className="text-sm text-slate-500">Selecione o arquivo CSV com os dados</p>
          </div>
        </div>

        <div
          className={`rounded-xl border-2 border-dashed p-14 text-center transition-all cursor-pointer ${
            dragActive ? `${borderMap[entity.color]} border-solid` : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${colorMap[entity.color]}`}>
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Arraste o arquivo aqui</h3>
          <p className="text-sm text-slate-500 mb-5">ou clique para selecionar</p>
          <span className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium">
            <Upload className="w-4 h-4" />
            Selecionar Arquivo
          </span>
          <p className="text-xs text-slate-400 mt-4">Formatos aceitos: CSV (.csv)</p>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Table2 className="w-4 h-4 text-purple-600" />
            Campos esperados para {entity.label}
          </h3>
          <div className="grid md:grid-cols-2 gap-2">
            {entity.fields.map(f => (
              <div key={f.key} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.required ? 'bg-red-400' : 'bg-slate-300'}`} />
                <div>
                  <span className="font-medium text-slate-800">{f.label}</span>
                  {f.required && <span className="ml-1 text-red-500 text-xs">*</span>}
                  {f.hint && <p className="text-xs text-slate-400">{f.hint}</p>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3"><span className="text-red-500">*</span> Campo obrigatório</p>
        </div>

        <div className="mt-4 flex justify-between">
          <button onClick={reset} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => downloadCSV(`template_${entity.id}.csv`, buildCSV(entity.fields))}
            className="flex items-center gap-2 px-4 py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar Template CSV
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Field Mapping ──
  if (step === 'mapping' && entity) {
    const Icon = entity.icon;
    const mappedCount = Object.values(fieldMapping).filter(v => v !== '').length;

    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStep('upload')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[entity.color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Mapeamento de Campos</h1>
            <p className="text-sm text-slate-500">{fileName} · {csvRows.length} registros · {mappedCount} colunas mapeadas</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 grid grid-cols-2 gap-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Coluna do CSV</p>
              <p className="text-xs font-semibold text-slate-500 uppercase">Campo do Sistema</p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {csvHeaders.map(h => (
                <div key={h} className="p-3 grid grid-cols-2 gap-4 items-center hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-sm font-mono text-slate-800 truncate">{h}</span>
                  </div>
                  <select
                    value={fieldMapping[h] ?? ''}
                    onChange={(e) => setFieldMapping(prev => ({ ...prev, [h]: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="">— Ignorar esta coluna —</option>
                    {entity.fields.map(f => (
                      <option key={f.key} value={f.key}>
                        {f.label}{f.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">Resumo</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total de registros</span>
                  <span className="font-semibold text-slate-900">{csvRows.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Válidos</span>
                  <span className="font-semibold text-green-600">{validRows.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Com erros (campos req.)</span>
                  <span className="font-semibold text-red-600">{invalidRows}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Colunas mapeadas</span>
                  <span className="font-semibold text-slate-900">{mappedCount} / {csvHeaders.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">Campos obrigatórios</h3>
              <div className="space-y-1.5">
                {requiredFields.map(k => {
                  const isMapped = Object.values(fieldMapping).includes(k);
                  return (
                    <div key={k} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${isMapped ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {isMapped ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {entity.fields.find(f => f.key === k)?.label ?? k}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <button onClick={() => setStep('upload')} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
          <button
            onClick={() => setStep('preview')}
            disabled={validRows.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            Visualizar dados
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Preview ──
  if (step === 'preview' && entity) {
    const Icon = entity.icon;
    const previewRows = validRows.slice(0, 10);
    const mappedKeys = entity.fields.filter(f => Object.values(fieldMapping).includes(f.key));

    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStep('mapping')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[entity.color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pré-visualização</h1>
            <p className="text-sm text-slate-500">Exibindo {previewRows.length} de {validRows.length} registros válidos</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: csvRows.length, color: 'text-slate-900', bg: 'bg-slate-50' },
            { label: 'Válidos', value: validRows.length, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Com erros', value: invalidRows, color: 'text-red-700', bg: 'bg-red-50' },
            { label: 'Campos mapeados', value: Object.values(fieldMapping).filter(Boolean).length, color: 'text-purple-700', bg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-slate-200`}>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Prévia dos dados (primeiros 10 registros válidos)</span>
            {invalidRows > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                {invalidRows} {invalidRows === 1 ? 'registro inválido será ignorado' : 'registros inválidos serão ignorados'}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-slate-500 font-semibold">#</th>
                  {mappedKeys.map(f => (
                    <th key={f.key} className="px-3 py-2 text-left text-xs text-slate-500 font-semibold whitespace-nowrap">
                      {f.label}{f.required ? ' *' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    {mappedKeys.map(f => (
                      <td key={f.key} className="px-3 py-2 text-slate-800 max-w-[180px] truncate" title={row[f.key]}>
                        {row[f.key] || <span className="text-slate-300 italic text-xs">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep('mapping')} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
          <button
            onClick={handleImport}
            disabled={importing || validRows.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium text-sm"
          >
            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Importando...' : `Importar ${validRows.length} registros`}
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Result ──
  if (step === 'result' && result) {
    const success = result.success > 0;
    return (
      <div className="p-6 max-w-2xl">
        <div className={`rounded-2xl p-8 text-center mb-6 ${success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${success ? 'bg-green-100' : 'bg-red-100'}`}>
            {success ? <Check className="w-10 h-10 text-green-600" /> : <X className="w-10 h-10 text-red-600" />}
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${success ? 'text-green-900' : 'text-red-900'}`}>
            {success ? 'Importação concluída!' : 'Falha na importação'}
          </h2>
          {result.success > 0 && (
            <p className="text-green-700">{result.success} registros importados com sucesso</p>
          )}
          {result.errors.length > 0 && (
            <p className="text-red-700 mt-1">{result.errors.length} erro(s) encontrados</p>
          )}
        </div>

        {result.errors.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <h3 className="font-semibold text-slate-900 mb-3 text-sm">Detalhes dos erros</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {result.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-sm bg-red-50 rounded-lg px-3 py-2">
                  <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-red-700">{e.row > 0 ? `Linha ${e.row}: ` : ''}{e.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={reset} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
            Nova Importação
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export function Export() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Exportação de Dados</h1>
        <p className="text-slate-600 dark:text-slate-400">Exporte dados do sistema em diversos formatos</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Download className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600">Funcionalidade de exportação em desenvolvimento</p>
      </div>
    </div>
  );
}
