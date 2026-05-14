import { ReactNode } from 'react';
import { Search, Plus, LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

interface GenericListProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradientFrom: string;
  gradientTo: string;
  stats?: { label: string; value: string | number; color?: string }[];
  searchPlaceholder?: string;
  addButtonLabel?: string;
  addButtonPath?: string;
  children: ReactNode;
}

export function GenericList({
  title,
  description,
  icon: Icon,
  gradientFrom,
  gradientTo,
  stats,
  searchPlaceholder = 'Buscar...',
  addButtonLabel = 'Adicionar',
  addButtonPath,
  children
}: GenericListProps) {
  const solidBg = gradientFrom.replace(/^from-/, 'bg-');
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${solidBg} rounded-xl flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
            <p className="text-slate-600 dark:text-slate-400">{description}</p>
          </div>
        </div>
        {addButtonPath && (
          <Link to={addButtonPath} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            {addButtonLabel}
          </Link>
        )}
      </div>

      {stats && stats.length > 0 && (
        <div className={`grid grid-cols-${stats.length} gap-6 mb-6`}>
          {stats.map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color || 'text-slate-900'}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {children}
    </div>
  );
}
