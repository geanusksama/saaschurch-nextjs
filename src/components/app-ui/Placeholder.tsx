import { Link, useLocation } from 'react-router';
import { ArrowLeft, Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description: string;
  backPath: string;
  backLabel: string;
}

export function Placeholder({ title, description, backPath, backLabel }: PlaceholderProps) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <Link 
          to={backPath} 
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          {backLabel}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="text-slate-600 dark:text-slate-400">{description}</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Construction className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Página em Desenvolvimento</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Esta funcionalidade estará disponível em breve.</p>
        <Link
          to={backPath}
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </Link>
      </div>
    </div>
  );
}

// Import actual components
export { CRMNew } from './CRMNew';
export { EventsNew } from './EventsNew';
export { CheckInManual } from './CheckInManual';
export { CheckInHistory } from './CheckInHistory';
export { EmailNew } from './EmailNew';
export { AutomationBuilder } from './AutomationBuilder';
export { FinanceCashFlow } from './FinanceCashFlow';
export { RequirementsNew } from './RequirementsNew';

// Legacy placeholders for backwards compatibility
export function BaptismNew() {
  return <Placeholder title="Novo Pedido de Batismo" description="Registrar novo pedido de batismo" backPath="/app-ui/baptism" backLabel="Voltar para Batismo" />;
}

export function FinanceNew() {
  return <Placeholder title="Nova Transação" description="Registrar nova transação financeira" backPath="/app-ui/finance" backLabel="Voltar para Financeiro" />;
}