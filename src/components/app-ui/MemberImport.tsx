import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Users, AlertTriangle, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = '/api';

interface ValidationReport {
  totalCSV: number;
  willImport: number;
  duplicates: number;
  errors: number;
  errorDetails: Array<{ linha: number; nome?: string; motivo: string }>;
  warnings: Array<{ linha: number; nome?: string; motivo: string }>;
  unmappedCsvColumns: string[];
  unknownChurches: string[];
}

interface ImportResult {
  membros: { imported: number; updated: number; skipped: number; errors: Array<{ rol?: string; nome?: string; motivo: string }> };
  contatos: { updated: number; skipped: number; errors: Array<{ idtbmembro?: string; motivo: string }> } | null;
}

type Step = 'upload' | 'validating' | 'report' | 'importing' | 'done';

export function MemberImport() {
  const token = localStorage.getItem('mrm_token');  const [step, setStep] = useState<Step>('upload');
  const [membrosFile, setMembrosFile] = useState<File | null>(null);
  const [contatosFile, setContatosFile] = useState<File | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const [showUnknownChurches, setShowUnknownChurches] = useState(false);
  const membrosRef = useRef<HTMLInputElement>(null);
  const contatosRef = useRef<HTMLInputElement>(null);

  async function handleValidate() {
    if (!membrosFile) { setError('Selecione o arquivo membros.csv'); return; }
    setError(null);
    setStep('validating');
    try {
      const fd = new FormData();
      fd.append('membros', membrosFile);
      const res = await fetch(`${API_BASE}/api/members/import-csv/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro na validação'); }
      const data: ValidationReport = await res.json();
      setReport(data);
      setStep('report');
    } catch (e: any) {
      setError(e.message || 'Erro ao validar arquivo');
      setStep('upload');
    }
  }

  async function handleImport() {
    if (!membrosFile) return;
    setError(null);
    setStep('importing');
    try {
      const fd = new FormData();
      fd.append('membros', membrosFile);
      if (contatosFile) fd.append('contatos', contatosFile);
      const res = await fetch(`${API_BASE}/api/members/import-csv/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro na importação'); }
      const data: ImportResult = await res.json();
      setResult(data);
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Erro ao importar');
      setStep('report');
    }
  }

  function reset() {
    setStep('upload');
    setMembrosFile(null);
    setContatosFile(null);
    setReport(null);
    setResult(null);
    setError(null);
    setShowErrorDetails(false);
    setShowWarningDetails(false);
    setShowUnknownChurches(false);
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Importar Membros via CSV</h1>
          <p className="text-slate-500 text-sm">Importe membros e contatos a partir dos arquivos CSV legados. O processo valida antes de inserir.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { key: 'upload', label: '1. Selecionar Arquivos' },
            { key: 'report', label: '2. Relatório de Validação' },
            { key: 'done', label: '3. Resultado' },
          ].map((s, i) => {
            const isActive = step === s.key || (step === 'validating' && s.key === 'report') || (step === 'importing' && s.key === 'done');
            const isDone =
              (s.key === 'upload' && ['report', 'validating', 'importing', 'done'].includes(step)) ||
              (s.key === 'report' && ['importing', 'done'].includes(step));
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {isDone ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : isDone ? 'text-green-700' : 'text-slate-400'}`}>{s.label}</span>
                {i < 2 && <div className="w-8 h-px bg-slate-200 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* De/Para reference */}
            <details className="bg-blue-50 border border-blue-200 rounded-xl">
              <summary className="p-4 cursor-pointer font-semibold text-blue-900 text-sm">Ver mapeamento de colunas (De/Para CSV → Banco)</summary>
              <div className="px-4 pb-4 overflow-x-auto">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="p-2 text-left border border-blue-200">Coluna CSV</th>
                      <th className="p-2 text-left border border-blue-200">Coluna na Tabela members</th>
                      <th className="p-2 text-left border border-blue-200">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100">
                    {[
                      ['id','rol','Número de rol do membro (chave de upsert)'],
                      ['nome','full_name',''],
                      ['nomefantasia','fantasy_name','Nome fantasia / razão social para cadastros PJ'],
                      ['campo','campo_id','Busca UUID em campos.code ou campos.name (ex: campinas)'],
                      ['idigreja / igreja','church_id','Extrai código XX-XXX-XXX do campo "igreja", busca UUID em churches.code'],
                      ['regional','regional_id','Busca por nome/código na tabela regionais'],
                      ['datanasc','birth_date','Aceita dd/mm/yyyy ou yyyy-mm-dd'],
                      ['sexo','gender','Masculino / Feminino'],
                      ['cpf','cpf',''],
                      ['rg','rg',''],
                      ['estadocivil','marital_status',''],
                      ['nacionalidade','nationality',''],
                      ['naturalidade','naturality_city',''],
                      ['profissao','occupation',''],
                      ['nomepai','father_name',''],
                      ['nomemae','mother_name',''],
                      ['nomeconjuge','spouse_name',''],
                      ['tituloeclesiastico','ecclesiastical_title',''],
                      ['situacao / status','membership_status',''],
                      ['datacadastro','membership_date',''],
                      ['batizado','baptism_status','1/sim/true → BATIZADO'],
                      ['databatismo','baptism_date',''],
                      ['email','email',''],
                      ['foto','photo_url',''],
                      ['logradouro','address_street',''],
                      ['numero','address_number',''],
                      ['complemento','address_complement',''],
                      ['bairro','address_neighborhood',''],
                      ['cidade','address_city',''],
                      ['estado / uf','address_state',''],
                      ['cep','address_zipcode',''],
                      ['titulo','voter_registration','Título eleitoral'],
                      ['zona','voter_zone',''],
                      ['secao','voter_section',''],
                      ['obs','notes',''],
                      ['funcao','member_type',''],
                      ['—','created_by / updated_by','UUID do usuário logado (auditoria automática — equivale ao idusuariofb do sistema legado)'],
                    ].map(([csv, db, obs]) => (
                      <tr key={csv} className="hover:bg-blue-50">
                        <td className="p-2 font-mono border border-blue-100 text-blue-800">{csv}</td>
                        <td className="p-2 font-mono border border-blue-100 text-slate-700">{db}</td>
                        <td className="p-2 border border-blue-100 text-slate-500">{obs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-500">
                  <strong>Colunas NÃO importadas</strong> (sem correspondência no banco): grauinstrucao, tipodoc, documento, orgaorg, dataemissaorg, matricula, matriculaconv, armario, idindicado, atendido, idatendido, datacontato, obsatendiemnto, statusatendimento, latitudelongtude, apartamento, quermembrar, filhos, emuso, dizimo, idfirebase, idusuariofb, idunico, classe, pais, cidadedoc, rash, ativo, disponivelfilha.
                </p>
              </div>
            </details>

            {/* File 1: membros.csv */}
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => membrosRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setMembrosFile(f); }}
            >
              <input ref={membrosRef} type="file" accept=".csv" className="hidden" onChange={e => setMembrosFile(e.target.files?.[0] || null)} />
              {membrosFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">{membrosFile.name}</p>
                    <p className="text-sm text-slate-500">{(membrosFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button className="ml-4 text-slate-400 hover:text-red-500" onClick={e => { e.stopPropagation(); setMembrosFile(null); }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="font-semibold text-slate-700">Arraste ou clique para selecionar <span className="text-blue-600">membros.csv</span></p>
                  <p className="text-sm text-slate-400 mt-1">Obrigatório · arquivo CSV com os membros</p>
                </>
              )}
            </div>

            {/* File 2: contatomembro.csv */}
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 transition-colors bg-slate-50"
              onClick={() => contatosRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setContatosFile(f); }}
            >
              <input ref={contatosRef} type="file" accept=".csv" className="hidden" onChange={e => setContatosFile(e.target.files?.[0] || null)} />
              {contatosFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-7 h-7 text-blue-500" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">{contatosFile.name}</p>
                    <p className="text-sm text-slate-500">{(contatosFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button className="ml-4 text-slate-400 hover:text-red-500" onClick={e => { e.stopPropagation(); setContatosFile(null); }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-500">Arraste ou clique para selecionar <span className="text-blue-500">contatomembro.csv</span></p>
                  <p className="text-xs text-slate-400 mt-1">Opcional · atualiza telefone, celular e e-mail dos membros</p>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button
                disabled={!membrosFile}
                onClick={handleValidate}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-5 h-5" />
                Validar Arquivo
              </button>
            </div>
          </div>
        )}

        {/* STEP: VALIDATING */}
        {step === 'validating' && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-slate-600 font-medium">Analisando arquivo e verificando correspondências…</p>
          </div>
        )}

        {/* STEP: REPORT */}
        {step === 'report' && report && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900">Relatório de Validação</h2>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                <p className="text-3xl font-bold text-slate-900">{report.totalCSV.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-slate-500 mt-1">Registros no CSV</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                <p className="text-3xl font-bold text-green-700">{report.willImport.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-green-600 mt-1">Serão importados (novos)</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-center">
                <p className="text-3xl font-bold text-blue-700">{report.duplicates.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-blue-600 mt-1">Já existem (serão atualizados)</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200 text-center">
                <p className="text-3xl font-bold text-red-700">{report.errors.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-red-600 mt-1">Registros com erro (ignorados)</p>
              </div>
            </div>

            {/* Unknown churches */}
            {report.unknownChurches.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <button
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setShowUnknownChurches(v => !v)}
                >
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <span className="font-semibold text-yellow-800">
                    {report.unknownChurches.length} igrejas não encontradas no banco — membros dessas igrejas serão ignorados
                  </span>
                  {showUnknownChurches ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                </button>
                {showUnknownChurches && (
                  <ul className="mt-3 text-sm text-yellow-800 space-y-1 pl-7">
                    {report.unknownChurches.map((c, i) => <li key={i} className="font-mono">{c}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Unmapped columns */}
            {report.unmappedCsvColumns.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Colunas do CSV sem correspondência (não serão importadas):</p>
                <div className="flex flex-wrap gap-2">
                  {report.unmappedCsvColumns.map(c => (
                    <span key={c} className="bg-slate-200 text-slate-600 text-xs font-mono px-2 py-1 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {report.errorDetails.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <button
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setShowErrorDetails(v => !v)}
                >
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span className="font-semibold text-red-800">{report.errorDetails.length} erros detectados (primeiros 50)</span>
                  {showErrorDetails ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                </button>
                {showErrorDetails && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead><tr className="bg-red-100"><th className="p-2 text-left">Linha</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Motivo</th></tr></thead>
                      <tbody>
                        {report.errorDetails.map((e, i) => (
                          <tr key={i} className="border-t border-red-100">
                            <td className="p-2 font-mono">{e.linha}</td>
                            <td className="p-2">{e.nome || '—'}</td>
                            <td className="p-2 text-red-700">{e.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Warnings */}
            {report.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <button
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setShowWarningDetails(v => !v)}
                >
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <span className="font-semibold text-yellow-800">{report.warnings.length} avisos</span>
                  {showWarningDetails ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                </button>
                {showWarningDetails && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead><tr className="bg-yellow-100"><th className="p-2 text-left">Linha</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Aviso</th></tr></thead>
                      <tbody>
                        {report.warnings.map((w, i) => (
                          <tr key={i} className="border-t border-yellow-100">
                            <td className="p-2 font-mono">{w.linha}</td>
                            <td className="p-2">{w.nome || '—'}</td>
                            <td className="p-2 text-yellow-700">{w.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {contatosFile && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Arquivo de contatos selecionado: <strong>{contatosFile.name}</strong> — será processado após os membros
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button onClick={reset} className="text-slate-500 hover:text-slate-800 text-sm font-medium">
                ← Voltar e trocar arquivo
              </button>
              <button
                onClick={handleImport}
                className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                <Users className="w-5 h-5" />
                Confirmar e Importar {report.willImport.toLocaleString('pt-BR')} membros
              </button>
            </div>
          </div>
        )}

        {/* STEP: IMPORTING */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
            <p className="text-slate-600 font-medium">Importando membros para o banco de dados…</p>
            <p className="text-slate-400 text-sm">Isso pode levar alguns minutos para ~26 mil registros</p>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && result && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <h2 className="text-xl font-bold text-slate-900">Importação concluída!</h2>
            </div>

            {/* Membros results */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-bold text-slate-800 mb-4 text-lg">Membros</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-700">{result.membros.imported.toLocaleString('pt-BR')}</p>
                  <p className="text-sm text-slate-500">Criados</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-700">{result.membros.updated.toLocaleString('pt-BR')}</p>
                  <p className="text-sm text-slate-500">Atualizados</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-500">{result.membros.skipped.toLocaleString('pt-BR')}</p>
                  <p className="text-sm text-slate-500">Ignorados/Erros</p>
                </div>
              </div>
              {result.membros.errors.length > 0 && (
                <details className="bg-red-50 rounded-lg p-3">
                  <summary className="text-sm font-semibold text-red-700 cursor-pointer">
                    {result.membros.errors.length} erros (primeiros 100)
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead><tr className="bg-red-100"><th className="p-2 text-left">Rol</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Erro</th></tr></thead>
                      <tbody>
                        {result.membros.errors.map((e, i) => (
                          <tr key={i} className="border-t border-red-100">
                            <td className="p-2 font-mono">{e.rol || '—'}</td>
                            <td className="p-2">{e.nome || '—'}</td>
                            <td className="p-2 text-red-700">{e.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>

            {/* Contatos results */}
            {result.contatos && (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-800 mb-4 text-lg">Contatos</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-700">{result.contatos.updated.toLocaleString('pt-BR')}</p>
                    <p className="text-sm text-slate-500">Atualizados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-500">{result.contatos.skipped.toLocaleString('pt-BR')}</p>
                    <p className="text-sm text-slate-500">Ignorados</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={reset}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
              >
                Nova Importação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

