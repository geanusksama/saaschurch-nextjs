import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Receipt, Search, Camera, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import { checkChurchCashStatus } from '../../lib/financeCashStatus';

type Church = { id: string; name: string };
type PlanoDeContas = { id: string; nome: string; codigo: string | null };
type FormaPagamento = { id: string; nome: string };
type TipoDocumento = { id: string; nome: string; sigla: string | null };

export default function ExpenseNew() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [churches, setChurches] = useState<Church[]>([]);
  const [planos, setPlanos] = useState<PlanoDeContas[]>([]);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [tiposDocs, setTiposDocs] = useState<TipoDocumento[]>([]);

  const [churchId, setChurchId] = useState('');
  const [churchSearch, setChurchSearch] = useState('');
  const [showChurchList, setShowChurchList] = useState(false);
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().split('T')[0]);
  const [favorecido, setFavorecido] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [formaId, setFormaId] = useState('');
  const [tipoDocId, setTipoDocId] = useState('');
  const [numDoc, setNumDoc] = useState('');
  const [valor, setValor] = useState('');
  const [referencia, setReferencia] = useState('');
  const [obs, setObs] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, p, f, t] = await Promise.all([
        supabase.from('churches').select('id, name').order('name').limit(300),
        supabase.from('plano_de_contas').select('id, nome, codigo').eq('tipo', 'DESPESA').eq('ativo', true).order('nome'),
        supabase.from('forma_pagamento').select('id, nome').eq('mostrar', true).order('nome'),
        supabase.from('tipo_documento').select('id, nome, sigla').eq('disponivel_despesa', true).eq('ativo', true).order('nome'),
      ]);
      if (c.data) setChurches(c.data);
      if (p.data) setPlanos(p.data);
      if (f.data) setFormas(f.data);
      if (t.data) setTiposDocs(t.data);
    })();
  }, []);

  const filteredChurches = churches.filter(c =>
    c.name.toLowerCase().includes(churchSearch.toLowerCase())
  );

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  function removeFoto() {
    setFotoFile(null);
    setFotoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!churchId) { setError('Selecione a Igreja.'); return; }
    const valorNum = Number(valor.replace(',', '.'));
    if (!valor || isNaN(valorNum) || valorNum <= 0) { setError('Informe um valor valido.'); return; }

    const cashStatus = await checkChurchCashStatus(churchId, dataLancamento);
    if (!cashStatus.canInsert) { setError(cashStatus.message); return; }

    setSaving(true);
    let fotoUrl: string | null = null;

    if (fotoFile) {
      setUploadingFoto(true);
      try {
        const token = localStorage.getItem('mrm_token');
        const formData = new FormData();
        formData.append('file', fotoFile);
        const res = await fetch(`${apiBase}/upload/foto-despesa`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        setUploadingFoto(false);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erro no upload' }));
          setSaving(false);
          setError('Erro ao enviar foto: ' + (err.error || res.statusText));
          return;
        }
        const result = await res.json();
        fotoUrl = result.url;
      } catch (err: any) {
        setUploadingFoto(false);
        setSaving(false);
        setError('Erro ao enviar foto: ' + (err?.message || 'Erro desconhecido'));
        return;
      }
    }

    const plano = planos.find(p => p.id === planoId);
    const forma = formas.find(f => f.id === formaId);
    const tipoDoc = tiposDocs.find(t => t.id === tipoDocId);

    const { error: err } = await supabase.from('livro_caixa').insert({
      church_id: churchId,
      data_lancamento: dataLancamento,
      tipo: 'DESPESA',
      valor: valorNum,
      tipo_pessoa: 'NAO_MEMBRO',
      favorecido: favorecido || null,
      plano_de_conta: plano?.nome ?? null,
      forma_pg: forma?.nome ?? null,
      tipo_documento: tipoDoc?.nome ?? null,
      num_doc: numDoc || null,
      referencia: referencia || null,
      obs: obs || null,
      foto: fotoUrl,
    });
    setSaving(false);

    if (err) { setError('Erro ao salvar: ' + err.message); return; }
    setSuccess(true);
    setTimeout(() => navigate('/app-ui/finance/cashbook'), 1500);
  }

  if (success) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Despesa lancada com sucesso!</h2>
          <p className="text-slate-500 mt-1">Redirecionando para o Livro Caixa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app-ui/finance/cashbook" className="p-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <Receipt className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Lancar Despesa</h1>
          <p className="text-sm text-slate-500">Registre uma nova saida financeira</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">

          <div className="relative">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Igreja *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar igreja..."
                value={churchSearch}
                onFocus={() => setShowChurchList(true)}
                onBlur={() => setTimeout(() => setShowChurchList(false), 200)}
                onChange={e => { setChurchSearch(e.target.value); setChurchId(''); }}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            {showChurchList && filteredChurches.length > 0 && (
              <ul className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {filteredChurches.slice(0, 20).map(c => (
                  <li
                    key={c.id}
                    onMouseDown={() => { setChurchId(c.id); setChurchSearch(c.name); setShowChurchList(false); }}
                    className="px-4 py-2 text-sm hover:bg-red-50 cursor-pointer"
                  >
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
            {churchId && <p className="text-xs text-green-600 mt-1">Igreja selecionada</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Data Lancamento *</label>
              <input type="date" value={dataLancamento} onChange={e => setDataLancamento(e.target.value)} required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Favorecido / Fornecedor</label>
              <input type="text" placeholder="Nome do favorecido..." value={favorecido} onChange={e => setFavorecido(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Plano de Contas</label>
              <select value={planoId} onChange={e => setPlanoId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Selecione...</option>
                {planos.map(p => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} - ` : ''}{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Documento</label>
              <select value={tipoDocId} onChange={e => setTipoDocId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Selecione...</option>
                {tiposDocs.map(t => <option key={t.id} value={t.id}>{t.sigla ? `${t.sigla} - ` : ''}{t.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Forma de Pagamento</label>
              <select value={formaId} onChange={e => setFormaId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Selecione...</option>
                {formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">No Documento</label>
              <input type="text" placeholder="No do documento..." value={numDoc} onChange={e => setNumDoc(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Valor (R$) *</label>
              <input type="text" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Referencia (Mes/Ano)</label>
              <input type="text" placeholder="Mai/2026" value={referencia} onChange={e => setReferencia(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Observacoes</label>
            <textarea rows={3} placeholder="Observacoes adicionais..." value={obs} onChange={e => setObs(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Comprovante / Foto</label>
            {fotoPreview ? (
              <div className="relative inline-block">
                <img src={fotoPreview} alt="Preview" className="w-40 h-40 object-cover rounded-lg border border-slate-200" />
                <button type="button" onClick={removeFoto}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-red-400 hover:text-red-500 transition-colors text-sm">
                <Camera className="w-5 h-5" />
                Anexar comprovante (foto/PDF)
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFotoChange} className="hidden" />
            {uploadingFoto && <p className="text-xs text-slate-500 mt-1">Enviando foto...</p>}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link to="/app-ui/finance/cashbook"
            className="flex-1 py-3 text-center border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 text-sm">
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 text-sm">
            {saving ? 'Salvando...' : 'Lancar Despesa'}
          </button>
        </div>
      </form>
    </div>
  );
}
