// MRM Design System - Design Tokens

export const colors = {
  // Primary Colors
  primary: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6', // Main Purple
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
  },
  
  // Secondary Colors
  secondary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Main Blue
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  
  // Accent Colors
  accent: {
    green: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    orange: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
  },
  
  // Neutral Colors
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  
  // Semantic Colors
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
};

export const themes = {
  purple: {
    primary: colors.primary[500],
    primaryHover: colors.primary[600],
    primaryLight: colors.primary[100],
  },
  blue: {
    primary: colors.secondary[500],
    primaryHover: colors.secondary[600],
    primaryLight: colors.secondary[100],
  },
  green: {
    primary: colors.accent.green[500],
    primaryHover: colors.accent.green[600],
    primaryLight: colors.accent.green[100],
  },
  orange: {
    primary: colors.accent.orange[500],
    primaryHover: colors.accent.orange[600],
    primaryLight: colors.accent.orange[100],
  },
};

export const spacing = {
  xs: '4px',    // 4
  sm: '8px',    // 8
  md: '12px',   // 12
  lg: '16px',   // 16
  xl: '24px',   // 24
  '2xl': '32px', // 32
  '3xl': '48px', // 48
  '4xl': '64px',
  '5xl': '96px',
};

export const borderRadius = {
  small: '6px',
  medium: '8px',
  large: '12px',
  xl: '16px',
  full: '9999px',
};

export const typography = {
  heading: {
    fontSize: '24px',
    fontWeight: '700',
    lineHeight: '32px',
  },
  subheading: {
    fontSize: '18px',
    fontWeight: '600',
    lineHeight: '28px',
  },
  body: {
    fontSize: '14px',
    fontWeight: '400',
    lineHeight: '20px',
  },
  caption: {
    fontSize: '12px',
    fontWeight: '400',
    lineHeight: '16px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '20px',
  },
};

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
};
