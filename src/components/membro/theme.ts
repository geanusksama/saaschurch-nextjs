/**
 * Paleta do Portal "Sou Membro" — tema claro.
 *
 * As telas do portal estão migrando para o padrão claro (perfil e Face ID já
 * migraram). Antes cada tela repetia suas próprias cores, e o resultado era o
 * que se via na prática: conteúdo escrito em branco sobre fundo claro, ilegível.
 * Uma fonte só de cor evita esse conflito.
 *
 * Quem ainda depende do botão de tema (MembroShell e as telas antigas) continua
 * usando `useMembroColors()` — este arquivo é para as telas de tema fixo.
 */

export const MEMBRO = {
  /** azul das ações principais */
  ACCENT: '#2563eb',
  ACCENT_SOFT: '#eff6ff',
  BG: '#f1f5f9',
  CARD: '#ffffff',
  BORDER: '#e2e8f0',
  TEXT1: '#0f172a',
  TEXT2: '#64748b',
  TEXT3: '#94a3b8',
  DANGER: '#dc2626',
  OK: '#16a34a',
  WARN: '#d97706',
  SHADOW: '0 2px 12px rgba(15,23,42,0.06)',
} as const;
