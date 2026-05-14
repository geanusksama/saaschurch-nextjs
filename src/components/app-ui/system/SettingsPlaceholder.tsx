import { Settings, Save } from 'lucide-react';

interface SettingsPlaceholderProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function SettingsPlaceholder({ title, description, icon: Icon = Settings }: SettingsPlaceholderProps) {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="text-slate-600 dark:text-slate-400">{description}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-10 h-10 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">{description}</p>
          
          <button className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors mx-auto">
            <Save className="w-5 h-5" />
            Configurar Agora
          </button>
        </div>
      </div>
    </div>
  );
}
