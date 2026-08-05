import { useEffect, useRef, useState } from 'react';
import { Package, Camera, Save, X, Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { apiBase } from '../../lib/apiBase';
import { hasFixedChurchScope } from './churchScope';
import { ASSET_LOCATION_OPTIONS } from '../../lib/assetLocationOptions';

type Church = { id: string; name: string; code?: string | null };

interface Props {
  /** null = criando um bem novo; string = editando o bem desse id */
  assetId: string | null;
  onClose: () => void;
  onSaved: (asset: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const EMPTY_FORM = {
  churchId: '',
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
};

export function AssetFormDrawer({ assetId, onClose, onSaved }: Props) {
  const isEdit = Boolean(assetId);
  const token = localStorage.getItem('mrm_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const fixedChurch = hasFixedChurchScope(currentUser);

  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM, churchId: currentUser.churchId || '' });

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
    if (!assetId) {
      setForm({ ...EMPTY_FORM, churchId: currentUser.churchId || '' });
      setPhotoPreview(null);
      setPhotoFile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetch(`${apiBase}/assets/${assetId}`, { headers: authHeaders })
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
        setPhotoFile(null);
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((e: any) => setError(e.message || 'Falha ao carregar bem.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  useEffect(() => {
    if (form.qrToken) {
      QRCode.toDataURL(form.qrToken, { errorCorrectionLevel: 'M', margin: 1, width: 200 })
        .then(setQrDataUrl).catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
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
      const url = isEdit ? `${apiBase}/assets/${assetId}` : `${apiBase}/assets`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Falha ao salvar.'); }
      const saved = await res.json();
      toast.success(isEdit ? 'Bem atualizado!' : 'Bem cadastrado!');
      onSaved(saved);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl sm:w-[560px] text-slate-900 dark:text-slate-100">
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{isEdit ? `Editar Bem${form.code ? ` — ${form.code}` : ''}` : 'Novo Bem Patrimonial'}</h2>
              <p className="text-xs text-slate-500">Cadastro de bem móvel da igreja</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form id="asset-form" onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-6">
              {error && <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

              <div className="flex items-start gap-6">
                <div
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden bg-slate-50 dark:bg-slate-800 flex-shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Foto do bem" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <Camera className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-[11px]">Fotografar</span>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)} />
                </div>

                {isEdit && qrDataUrl && (
                  <div className="text-center">
                    <img src={qrDataUrl} alt="QR Code do bem" className="w-24 h-24 border border-slate-200 rounded-lg" />
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1"><QrCode className="w-3 h-3" /> QR</p>
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">Nome do Bem *</label>
                  <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" placeholder="Ex: Cadeira plástica branca" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Igreja *</label>
                  {fixedChurch ? (
                    <div className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {churches.find((c) => c.id === form.churchId)?.name || 'Sua igreja'}
                    </div>
                  ) : (
                    <select required value={form.churchId} onChange={(e) => setForm((f) => ({ ...f, churchId: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800">
                      <option value="">Selecione...</option>
                      {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
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

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">Descrição / observações</label>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" rows={3} />
                </div>
              </div>
            </div>
          )}
        </form>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
          <button type="submit" form="asset-form" disabled={saving || loading} className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </footer>
      </aside>
    </>
  );
}
