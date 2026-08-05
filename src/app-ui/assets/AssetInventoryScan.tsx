import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, CheckCircle2, Loader2, MapPin, QrCode, RotateCcw, XCircle, FileCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import { normalizeAssetCode } from './assetScanRules';

const SCANNER_ID = 'mrm-asset-inventory-qr-reader';

type ScanResult = {
  item: { id: string; assetId: string; locationMatch: boolean; locationFound?: string | null; observation?: string | null; asset: { name: string; code: string; sector?: string | null; photoUrl?: string | null } };
  registeredLocationLabel: string;
};

export default function AssetInventoryScan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('mrm_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showObsForm, setShowObsForm] = useState(false);
  const [locationFound, setLocationFound] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const [totals, setTotals] = useState<{ expected: number; found: number; missing: number; divergent: number } | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const cooldownRef = useRef<Record<string, number>>({});

  const loadTotals = useCallback(async () => {
    const res = await fetch(`${apiBase}/asset-inventories/${id}`, { headers: authHeaders });
    if (res.ok) { const data = await res.json(); setTotals(data.totals); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { loadTotals(); }, [loadTotals]);

  const doScan = useCallback(async (rawCode: string, extra?: { locationFound?: string; observation?: string }) => {
    const normalized = normalizeAssetCode(rawCode) || rawCode.trim();
    if (!normalized) return;
    const now = Date.now();
    if (!extra && cooldownRef.current[normalized] && now - cooldownRef.current[normalized] < 3000) return;
    cooldownRef.current[normalized] = now;
    if (busyRef.current) return;

    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/asset-inventories/${id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ code: normalized, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível ler este código.');
      setResult(data);
      setLastCode(normalized);
      setShowObsForm(false);
      setLocationFound('');
      setObservation('');
      loadTotals();
      if (!extra) toast.success(`${data.item.asset.name} conferido.`);
      else toast.success('Observação registrada.');
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'Erro ao ler código.');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadTotals]);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try { if (scanner.isScanning) await scanner.stop(); await scanner.clear(); } catch { /* ignora */ }
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => { void doScan(decodedText); },
        () => { /* ignora falhas de frame */ },
      );
      setScanning(true);
    } catch {
      setCamError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
      setScanning(false);
    }
  }, [doScan]);

  useEffect(() => { return () => { void stopCamera(); }; }, [stopCamera]);

  async function saveObservation() {
    if (!result || !lastCode) return;
    setSaving(true);
    try {
      await doScan(lastCode, { locationFound, observation });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setManualCode('');
    setShowObsForm(false);
  }

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
            <QrCode className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Leitor de Inventário</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Aponte a câmera para o QR de cada bem</p>
          </div>
        </div>
        <Link
          to={`/app-ui/asset-inventories/${id}/report`}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-medium"
        >
          <FileCheck className="w-4 h-4" /> Ver relatório / Finalizar
        </Link>
      </div>

      {totals && (
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Esperados" value={totals.expected} color="text-slate-700" />
          <Stat label="Encontrados" value={totals.found} color="text-green-700" />
          <Stat label="Faltando" value={totals.missing} color="text-red-700" />
          <Stat label="Divergências" value={totals.divergent} color="text-amber-700" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 font-bold">Leitor</h3>
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
            <div id={SCANNER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            {!scanning ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-400">
                <Camera className="h-8 w-8" /> Câmera desligada
              </div>
            ) : null}
          </div>
          {camError ? <p className="mt-2 text-xs text-rose-600">{camError}</p> : null}
          <div className="mt-4 flex justify-center gap-2">
            {!scanning ? (
              <button onClick={startCamera} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <Camera className="h-4 w-4" /> Ligar câmera
              </button>
            ) : (
              <button onClick={stopCamera} className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200">
                <CameraOff className="h-4 w-4" /> Desligar
              </button>
            )}
          </div>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void doScan(manualCode); }}>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Código do QR do bem"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button type="submit" disabled={loading || !manualCode.trim()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Buscar</button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">Conferência</h3>
            {result ? (
              <button onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
                <RotateCcw className="h-3.5 w-3.5" /> Ler outro
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Consultando...</div>
          ) : null}

          {!loading && !result && !error ? (
            <p className="py-10 text-center text-sm text-slate-400">Escaneie o QR de um bem ou digite o código manualmente.</p>
          ) : null}

          {!loading && error ? (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/30">
              <div className="flex items-center gap-2 font-bold text-rose-700"><XCircle className="h-5 w-5" /> Não encontrado</div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{error}</p>
            </div>
          ) : null}

          {!loading && result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {result.item.asset.photoUrl && <img src={result.item.asset.photoUrl} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="" />}
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{result.item.asset.name}</p>
                  <p className="text-xs font-mono text-slate-500">{result.item.asset.code}{result.item.asset.sector ? ` · ${result.item.asset.sector}` : ''}</p>
                </div>
              </div>

              <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${result.item.locationMatch ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'}`}>
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p>Local cadastrado: <strong>{result.registeredLocationLabel}</strong></p>
                  {!result.item.locationMatch && (
                    <p className="mt-1">Encontrado em: <strong>{result.item.locationFound}</strong>{result.item.observation ? ` — ${result.item.observation}` : ''}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4" /> Item conferido no inventário
              </div>

              {!showObsForm ? (
                <button
                  onClick={() => setShowObsForm(true)}
                  className="flex items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                  <AlertTriangle className="h-4 w-4" /> Item está em outro lugar? Inserir observação
                </button>
              ) : (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Onde foi encontrado</label>
                  <input
                    value={locationFound}
                    onChange={(e) => setLocationFound(e.target.value)}
                    placeholder="Ex: Cozinha"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  />
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Observação</label>
                  <textarea
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => setShowObsForm(false)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600">Cancelar</button>
                    <button onClick={saveObservation} disabled={saving || !locationFound.trim()} className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50">
                      {saving ? 'Salvando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-slate-500 uppercase font-semibold">{label}</p>
    </div>
  );
}
