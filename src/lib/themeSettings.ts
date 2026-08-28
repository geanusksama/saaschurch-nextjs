export const THEME_STORAGE_KEY = 'mrm_branding';
export const THEME_EVENT_NAME = 'mrm:theme-settings-changed';

export type ThemePreset = 'lite-flat';

export interface ThemeSettings {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  radius: number;
  preset: ThemePreset;
}

/**
 * Paletas que já foram o padrão do sistema. Quem está em uma delas não
 * escolheu a cor — só herdou o default da época —, então migra sozinho para o
 * padrão atual. Tema customizado de verdade nunca é tocado.
 */
const LEGACY_DEFAULT_THEMES = [
  { primaryColor: '#334155', secondaryColor: '#7b8fb3' },
  { primaryColor: '#7c8ba1', secondaryColor: '#c7d2df' }, // cinza claro demais
];

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  logoUrl: null,
  primaryColor: '#475569',
  secondaryColor: '#94a3b8',
  radius: 10,
  preset: 'lite-flat',
};

function sanitizeHex(value: string | null | undefined, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value || '') ? (value as string) : fallback;
}

function clampRadius(value: number | null | undefined) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return DEFAULT_THEME_SETTINGS.radius;
  return Math.min(18, Math.max(6, numeric));
}

function hexToRgb(hex: string) {
  const normalized = sanitizeHex(hex, '#000000').replace('#', '');
  const numeric = parseInt(normalized, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function alpha(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function shade(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (channel: number) => Math.min(255, Math.max(0, channel + amount));
  return `#${[clamp(r), clamp(g), clamp(b)].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function loadThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME_SETTINGS };
    const parsed = JSON.parse(raw);
    const parsedPrimary = sanitizeHex(parsed.primaryColor, DEFAULT_THEME_SETTINGS.primaryColor);
    const parsedSecondary = sanitizeHex(parsed.secondaryColor, DEFAULT_THEME_SETTINGS.secondaryColor);
    const isUsingLegacyDefaultPalette = LEGACY_DEFAULT_THEMES.some(
      legacy => parsedPrimary === legacy.primaryColor && parsedSecondary === legacy.secondaryColor
    );

    return {
      logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : DEFAULT_THEME_SETTINGS.logoUrl,
      primaryColor: isUsingLegacyDefaultPalette ? DEFAULT_THEME_SETTINGS.primaryColor : parsedPrimary,
      secondaryColor: isUsingLegacyDefaultPalette ? DEFAULT_THEME_SETTINGS.secondaryColor : parsedSecondary,
      radius: clampRadius(parsed.radius),
      preset: parsed.preset === 'lite-flat' ? parsed.preset : DEFAULT_THEME_SETTINGS.preset,
    };
  } catch {
    return { ...DEFAULT_THEME_SETTINGS };
  }
}

export function saveThemeSettings(settings: ThemeSettings) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * O favicon NAO e mais tocado aqui.
 *
 * Ele e publico: todo visitante ve o mesmo icone. Sincronizar a partir do
 * localStorage (mrm_branding) so trocava o icone no navegador de quem tinha
 * salvo a marca, e ainda concorria com o icone que o servidor renderiza. A
 * fonte unica passou a ser Sistema -> Home Publica (home_configs.favicon_url).
 */

export function applyThemeSettings(settings: ThemeSettings) {
  const root = document.documentElement;
  const normalizedPrimary = sanitizeHex(settings.primaryColor, DEFAULT_THEME_SETTINGS.primaryColor);
  const normalizedSecondary = sanitizeHex(settings.secondaryColor, DEFAULT_THEME_SETTINGS.secondaryColor);
  const radius = clampRadius(settings.radius);

  root.dataset.themePreset = settings.preset;
  root.style.setProperty('--primary', normalizedPrimary);
  root.style.setProperty('--secondary', alpha(normalizedPrimary, 0.08));
  root.style.setProperty('--accent', alpha(normalizedPrimary, 0.1));
  root.style.setProperty('--ring', alpha(normalizedPrimary, 0.24));
  root.style.setProperty('--sidebar-primary', normalizedPrimary);
  root.style.setProperty('--sidebar-accent', alpha(normalizedPrimary, 0.08));
  root.style.setProperty('--sidebar-ring', alpha(normalizedPrimary, 0.22));
  root.style.setProperty('--radius', `${radius}px`);

  root.style.setProperty('--theme-primary', normalizedPrimary);
  root.style.setProperty('--theme-primary-strong', shade(normalizedPrimary, -14));
  root.style.setProperty('--theme-primary-hover', shade(normalizedPrimary, -8));
  root.style.setProperty('--theme-primary-soft', alpha(normalizedPrimary, 0.1));
  root.style.setProperty('--theme-primary-soft-strong', alpha(normalizedPrimary, 0.14));
  root.style.setProperty('--theme-primary-border', alpha(normalizedPrimary, 0.18));
  root.style.setProperty('--theme-primary-ring', alpha(normalizedPrimary, 0.14));
  root.style.setProperty('--theme-secondary', normalizedSecondary);
  root.style.setProperty('--theme-secondary-hover', shade(normalizedSecondary, -8));
  root.style.setProperty('--theme-secondary-soft', alpha(normalizedSecondary, 0.12));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_EVENT_NAME, {
      detail: {
        ...settings,
        primaryColor: normalizedPrimary,
        secondaryColor: normalizedSecondary,
        radius,
      },
    }));
  }
}

export function resetThemeSettings() {
  saveThemeSettings(DEFAULT_THEME_SETTINGS);
  applyThemeSettings(DEFAULT_THEME_SETTINGS);
}

export function getRadiusPresetOptions() {
  return [
    { label: 'Compacto', value: 8, description: 'Menos curva' },
    { label: 'Equilibrado', value: 10, description: 'Padrão lite flat' },
    { label: 'Suave', value: 14, description: 'Mais arredondado' },
  ];
}
