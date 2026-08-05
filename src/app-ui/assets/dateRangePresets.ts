function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toIso(from), to: toIso(to) };
}

export interface DateRangePreset {
  key: string;
  label: string;
  range: () => { from: string; to: string };
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    key: 'week',
    label: 'Esta semana',
    range: () => {
      const now = new Date();
      const day = now.getDay(); // 0 = domingo
      const from = new Date(now);
      from.setDate(now.getDate() - day);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      return { from: toIso(from), to: toIso(to) };
    },
  },
  {
    key: 'month',
    label: 'Este mês',
    range: currentMonthRange,
  },
  {
    key: 'last-month',
    label: 'Mês passado',
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toIso(from), to: toIso(to) };
    },
  },
  {
    key: 'year',
    label: 'Este ano',
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), 11, 31);
      return { from: toIso(from), to: toIso(to) };
    },
  },
];
