import { useState } from 'react';
import { X, Printer, Package } from 'lucide-react';
import { LABEL_PRESETS, printAssetLabels, type LabelAsset } from './printAssetLabels';

interface Props {
  assets: LabelAsset[];
  onClose: () => void;
}

export function AssetLabelPrintModal({ assets, onClose }: Props) {
  const [preset, setPreset] = useState(LABEL_PRESETS[0].id);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showSector, setShowSector] = useState(true);
  const [printing, setPrinting] = useState(false);

  const activePreset = LABEL_PRESETS.find((p) => p.id === preset)!;
  const previewItems = assets.slice(0, 6);

  async function handlePrint() {
    setPrinting(true);
    try {
      await printAssetLabels({ preset, assets, showPhoto, showSector });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <Printer className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Imprimir Etiquetas</h2>
              <p className="text-sm text-slate-500">{assets.length} bem(ns) selecionado(s)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2">Modelo de impressora / tamanho da etiqueta</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {LABEL_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`text-left px-4 py-3 rounded-lg border-2 transition-colors ${preset === p.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                >
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{p.label}</p>
                  <p className="text-xs text-slate-500">{p.widthMm}×{p.heightMm}mm{p.singlePerPage ? ' · impressão contínua (rolo)' : ' · folha A4'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showPhoto} onChange={(e) => setShowPhoto(e.target.checked)} /> Mostrar foto na etiqueta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showSector} onChange={(e) => setShowSector(e.target.checked)} /> Mostrar setor
            </label>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Pré-visualização ({activePreset.label})</p>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800 flex flex-wrap gap-2">
              {previewItems.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum bem selecionado.</p>
              ) : previewItems.map((a, i) => (
                <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5">
                  {showPhoto && a.photoUrl ? (
                    <img src={a.photoUrl} className="w-6 h-6 rounded object-cover" alt="" />
                  ) : (
                    <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center"><Package className="w-3.5 h-3.5 text-slate-400" /></div>
                  )}
                  <div className="w-6 h-6 bg-slate-900 rounded-sm" title="QR" />
                  <div className="text-left">
                    <p className="text-[10px] font-bold leading-tight">{a.name}</p>
                    <p className="text-[9px] text-slate-500 font-mono leading-tight">{a.code}{showSector && a.sector ? ` · ${a.sector}` : ''}</p>
                  </div>
                </div>
              ))}
              {assets.length > previewItems.length && (
                <span className="text-xs text-slate-400 self-center">+ {assets.length - previewItems.length} etiqueta(s)</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Cancelar</button>
          <button
            onClick={handlePrint}
            disabled={printing || assets.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> {printing ? 'Preparando...' : `Imprimir ${assets.length} etiqueta(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
