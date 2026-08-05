import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { Package, Camera, Save, ArrowLeft, Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { apiBase } from '../../lib/apiBase';
import { ASSET_LOCATION_OPTIONS } from '../../lib/assetLocationOptions';

type Church = { id: string; name: string; code?: string | null };

export default function AssetForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const token = localStorage.getItem('mrm_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();

  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    churchId: currentUser.churchId || '',
    name: '',
    category: '',
    sector: '',
    description: '',
    locationType: 'SALA',
    locationDetail: '',
    acquisitionType: '',
    acquisitionDate: '',
    value: '',
    status: 'active',
    photoUrl: '',
    qrToken: '',
    code: '',
  });

  useEffect(() => {
    const activeFieldId = localStorage.getItem('mrm_active_field_id') || currentUser.campoId || '';
    const fieldQuery = activeFieldId ? `?fieldId=${encodeURIComponent(activeFieldId)}` : '';
    fetch(`${apiBase}/churches${fieldQuery}`, { headers: authHeaders })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setChurches(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    fetch(`${apiBase}/assets/${id}`, { headers: authHeaders })
      .then((r) => { if (!r.ok) throw new Error('Bem não encontrado.'); return r.json(); })
      .then((data) => {
        setForm({
          churchId: data.churchId || '',
          name: data.name || '',
          category: data.category || '',
          sector: data.sector || '',
          description: data.description || '',
          locationType: data.locationType || 'SALA',
          locationDetail: data.locationDetail || '',
          acquisitionType: data.acquisitionType || '',
          acquisitionDate: data.acquisitionDate ? String(data.acquisitionDate).slice(0, 10) : '',
          value: data.value != null ? String(data.value) : '',
          status: data.status || 'active',
          photoUrl: data.photoUrl || '',
          qrToken: data.qrToken || '',
          code: data.code || '',
        });
        setPhotoPreview(data.photoUrl || null);
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((e: any) => setError(e.message || 'Falha ao carregar bem.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (form.qrToken) {
      QRCode.toDataURL(form.qrToken, { errorCorrectionLevel: 'M', margin: 1, width: 200 })
        .then(setQrDataUrl).catch(() => setQrDataUrl(null));
    }
  }, [form.qrToken]);

  function handlePhotoChange(file: File | null) {
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhotoIfNeeded(): Promise<string | null> {
    if (!photoFile) return form.photoUrl || null;
    const fd = new FormData();
    fd.append('file', photoFile);
    fd.append('folder', 'assets');
    const res = await fetch(`${apiBase}/upload`, { method: 'POST', headers: authHeaders, body: fd });
    if (!res.ok) throw new Error('Falha ao enviar foto.');
    const data = await res.json();
    return data.url as string;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return; }
    if (!form.churchId) { setError('Igreja é obrigatória.'); return; }
    setSaving(true);
    setError('');
    try {
      const photoUrl = await uploadPhotoIfNeeded();
      const payload = { ...form, photoUrl, value: form.value ? Number(form.value) : null };
      const url = isEdit ? `${apiBase}/assets/${id}` : `${apiBase}/assets`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Falha ao salvar.'); }
      const saved = await res.json();
      toast.success(isEdit ? 'Bem atualizado!' : 'Bem cadastrado!');
      navigate(`/app-ui/assets/${saved.id}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto text-slate-900 dark:text-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app-ui/assets" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="w-11 h-11 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
          <Package className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{isEdit ? `Editar Bem${form.code ? ` — ${form.code}` : ''}` : 'Novo Bem Patrimonial'}</h1>
          <p className="text-sm text-slate-500">Cadastro de bem móvel da igreja</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSave} className="space-y-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start gap-6">
          <div
            className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden bg-slate-50 dark:bg-slate-800 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Foto do bem" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-slate-400">
                <Camera className="w-6 h-6 mx-auto mb-1" />
                <span className="text-xs">Fotografar</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)} />
          </div>

          {isEdit && qrDataUrl && (
            <div className="text-center">
              <img src={qrDataUrl} alt="QR Code do bem" className="w-28 h-28 border border-slate-200 rounded-lg" />
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1"><QrCode className="w-3 h-3" /> QR de identificação</p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5">Nome do Bem *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" placeholder="Ex: Cadeira plástica branca" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Igreja *</label>
            <select required value={form.churchId} onChange={(e) => setForm((f) => ({ ...f, churchId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800">
              <option value="">Selecione...</option>
              {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Setor</label>
            <input value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" placeholder="Ex: Louvor, Secretaria, Cozinha" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Categoria</label>
            <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" placeholder="Ex: Mobiliário, Eletrônico" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800">
              <option value="active">Ativo</option>
              <option value="manutencao">Manutenção</option>
              <option value="baixado">Baixado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Onde fica</label>
            <select value={form.locationType} onChange={(e) => setForm((f) => ({ ...f, locationType: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800">
              {ASSET_LOCATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Detalhe do local</label>
            <input value={form.locationDetail} onChange={(e) => setForm((f) => ({ ...f, locationDetail: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" placeholder="Ex: Sala 3, Cozinha" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Aquisição</label>
            <select value={form.acquisitionType} onChange={(e) => setForm((f) => ({ ...f, acquisitionType: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800">
              <option value="">Não informado</option>
              <option value="DOACAO">Doação</option>
              <option value="COMPRA">Compra</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Data de aquisição</label>
            <input type="date" value={form.acquisitionDate} onChange={(e) => setForm((f) => ({ ...f, acquisitionDate: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Valor (R$)</label>
            <input type="number" step="0.01" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" placeholder="0,00" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5">Descrição / observações</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Link to="/app-ui/assets" className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Cancelar</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
