import { Upload, Save, RotateCcw, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import {
  applyThemeSettings,
  DEFAULT_THEME_SETTINGS,
  getRadiusPresetOptions,
  loadThemeSettings,
  saveThemeSettings,
  type ThemeSettings,
} from '../../../lib/themeSettings';

function hexShade(hex: string, amount: number): string {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  } catch { return hex; }
}

export function Branding() {
  const initialTheme = loadThemeSettings();
  const savedThemeRef = useRef<ThemeSettings>(initialTheme);
  const [data, setData] = useState<ThemeSettings>(initialTheme);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [primaryText, setPrimaryText] = useState(data.primaryColor);
  const [secondaryText, setSecondaryText] = useState(data.secondaryColor);

  useEffect(() => { setPrimaryText(data.primaryColor); }, [data.primaryColor]);
  useEffect(() => { setSecondaryText(data.secondaryColor); }, [data.secondaryColor]);
  useEffect(() => {
    applyThemeSettings(data);
    return () => applyThemeSettings(savedThemeRef.current);
  }, [data]);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Arquivo deve ter no máximo 2MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setData(d => ({ ...d, logoUrl: ev.target?.result as string }));
    reader.readAsDataURL(file);
  }

  function handlePrimaryText(v: string) {
    setPrimaryText(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) setData(d => ({ ...d, primaryColor: v }));
  }

  function handleSecondaryText(v: string) {
    setSecondaryText(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) setData(d => ({ ...d, secondaryColor: v }));
  }

  function handleSave() {
    saveThemeSettings(data);
    savedThemeRef.current = data;
    applyThemeSettings(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    setData({ ...DEFAULT_THEME_SETTINGS });
    setPrimaryText(DEFAULT_THEME_SETTINGS.primaryColor);
    setSecondaryText(DEFAULT_THEME_SETTINGS.secondaryColor);
  }

  const inputCls = 'flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-ring)] dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm';
  const radiusOptions = getRadiusPresetOptions();

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Marca e Aparência</h1>
        <p className="text-slate-500 dark:text-slate-400">Defina a cor predominante e o nível de curvatura do sistema inteiro</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Logo */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-6 font-bold text-slate-900 dark:text-white">Logo</h3>
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-purple-400 dark:border-slate-600 cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="Logo" className="mb-4 max-h-28 rounded-xl object-contain shadow" />
            ) : (
              <div
                className="mb-4 flex h-24 w-24 items-center justify-center rounded-xl text-white text-4xl font-bold shadow-lg"
                style={{ background: `linear-gradient(135deg, ${data.primaryColor}, ${data.secondaryColor})` }}
              >
                M
              </div>
            )}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
              className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: data.primaryColor }}
            >
              <Upload className="h-4 w-4" />
              Fazer Upload do Logo
            </button>
            <p className="mt-2 text-xs text-slate-400">PNG, JPG ou SVG até 2MB</p>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
          </div>
          {data.logoUrl && (
            <button
              type="button"
              onClick={() => setData(d => ({ ...d, logoUrl: null }))}
              className="mt-3 w-full rounded-xl border border-red-200 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
            >
              Remover logo
            </button>
          )}
        </div>

        {/* Colors */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-6 font-bold text-slate-900 dark:text-white">Tema Global</h3>
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Cor predominante</label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={data.primaryColor}
                  onChange={e => { setData(d => ({ ...d, primaryColor: e.target.value })); setPrimaryText(e.target.value); }}
                  className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700"
                />
                <input type="text" value={primaryText} maxLength={7} onChange={e => handlePrimaryText(e.target.value)} className={inputCls} placeholder="#334155" />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Cor de apoio</label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={data.secondaryColor}
                  onChange={e => { setData(d => ({ ...d, secondaryColor: e.target.value })); setSecondaryText(e.target.value); }}
                  className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700"
                />
                <input type="text" value={secondaryText} maxLength={7} onChange={e => handleSecondaryText(e.target.value)} className={inputCls} placeholder="#7b8fb3" />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Curvatura do tema</label>
              <div className="grid grid-cols-3 gap-3">
                {radiusOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setData(current => ({ ...current, radius: option.value }))}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${data.radius === option.value ? 'border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] ring-1 ring-[var(--theme-primary-ring)]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                  >
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{option.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Pré-visualização</p>
              <div className="space-y-4">
                <div className="flex gap-2">
                  {[0, 30, 60].map(amt => (
                    <div key={amt} className="h-12 w-12 rounded-xl shadow-sm" style={{ backgroundColor: hexShade(data.primaryColor, amt) }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  {[0, 30, 60].map(amt => (
                    <div key={amt} className="h-12 w-12 rounded-xl shadow-sm" style={{ backgroundColor: hexShade(data.secondaryColor, amt) }} />
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-semibold text-white shadow-sm"
                      style={{ backgroundColor: data.primaryColor, borderRadius: `${data.radius}px` }}
                    >
                      Ação primária
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 bg-white"
                      style={{ borderRadius: `${Math.max(4, data.radius - 2)}px` }}
                    >
                      Secundário
                    </button>
                  </div>
                  <div className="mt-3 border border-slate-200 bg-white p-3 text-sm text-slate-600"
                    style={{ borderRadius: `${data.radius + 2}px` }}
                  >
                    Padrão visual lite flat com cor mais suave e menos saturada.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RotateCcw className="h-4 w-4" />
          Restaurar Padrão
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: data.primaryColor }}
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Salvo!' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}
