import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Package, ArrowLeft, Edit, Loader2, QrCode, MapPin, Calendar, Tag, type LucideIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { apiBase } from '../../lib/apiBase';
import { printAssetLabels } from './printAssetLabels';
import { locationLabel } from '../../lib/assetLocationOptions';

const STATUS_LABELS: Record<string, string> = { active: 'Ativo', baixado: 'Baixado', manutencao: 'Manutenção' };

export default function AssetDetail() {
  const { id } = useParams();
  const token = localStorage.getItem('mrm_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [asset, setAsset] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${apiBase}/assets/${id}`, { headers: authHeaders })
      .then((r) => { if (!r.ok) throw new Error('Bem não encontrado.'); return r.json(); })
      .then((data) => {
        setAsset(data);
        return QRCode.toDataURL(data.qrToken, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
      })
      .then(setQrDataUrl)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((e: any) => setError(e.message || 'Falha ao carregar bem.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error || !asset) return <div className="p-6 text-red-600">{error || 'Bem não encontrado.'}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/app-ui/assets" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="w-11 h-11 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{asset.name}</h1>
            <p className="text-sm text-slate-500 font-mono">{asset.code}</p>
          </div>
        </div>
        <Link to={`/app-ui/assets/${id}/edit`} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Edit className="w-4 h-4" /> Editar
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          {asset.photoUrl && <img src={asset.photoUrl} alt={asset.name} className="w-full max-h-64 object-cover rounded-lg border border-slate-200" />}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info icon={Tag} label="Categoria" value={asset.category || '—'} />
            <Info icon={Tag} label="Setor" value={asset.sector || '—'} />
            <Info icon={MapPin} label="Igreja" value={asset.church?.name || '—'} />
            <Info icon={MapPin} label="Local" value={locationLabel(asset.locationType, asset.locationDetail)} />
            <Info icon={Calendar} label="Aquisição" value={asset.acquisitionType === 'DOACAO' ? 'Doação' : asset.acquisitionType === 'COMPRA' ? 'Compra' : '—'} />
            <Info icon={Calendar} label="Data de aquisição" value={asset.acquisitionDate ? new Date(asset.acquisitionDate).toLocaleDateString('pt-BR') : '—'} />
            <Info icon={Tag} label="Valor" value={asset.value != null ? Number(asset.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'} />
            <Info icon={Tag} label="Status" value={STATUS_LABELS[asset.status] || asset.status} />
          </div>
          {asset.description && (
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Descrição</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{asset.description}</p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-3 flex items-center justify-center gap-1"><QrCode className="w-3.5 h-3.5" /> QR de identificação</p>
          {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="mx-auto w-40 h-40" />}
          <button
            onClick={() => printAssetLabels({ preset: 'zebra-50x25', assets: [asset] })}
            className="mt-4 w-full px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900"
          >
            Imprimir etiqueta
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 pb-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
      <p className="font-medium text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}
