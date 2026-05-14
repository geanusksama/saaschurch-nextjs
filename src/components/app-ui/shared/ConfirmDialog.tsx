import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type Variant = 'danger' | 'warning' | 'info' | 'success';

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const variantStyles: Record<Variant, { icon: any; iconColor: string; iconBg: string; confirmBg: string }> = {
  danger: {
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    confirmBg: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    confirmBg: 'bg-amber-600 hover:bg-amber-700',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    confirmBg: 'bg-blue-600 hover:bg-blue-700',
  },
  success: {
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    confirmBg: 'bg-green-600 hover:bg-green-700',
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  const style = variantStyles[variant];
  const Icon = style.icon;

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-slate-900/50" onClick={loading ? undefined : onCancel} />
      <div className="fixed left-1/2 top-1/2 z-[100] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start gap-4 p-6">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}>
            <Icon className={`h-6 w-6 ${style.iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {message ? <p className="mt-1 text-sm text-slate-600">{message}</p> : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${style.confirmBg}`}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

type AlertProps = {
  open: boolean;
  title: string;
  message?: string;
  variant?: Variant;
  buttonLabel?: string;
  onClose: () => void;
};

export function AlertDialog({ open, title, message, variant = 'info', buttonLabel = 'OK', onClose }: AlertProps) {
  if (!open) return null;
  const style = variantStyles[variant];
  const Icon = style.icon;

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-slate-900/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[100] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start gap-4 p-6">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}>
            <Icon className={`h-6 w-6 ${style.iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {message ? <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{message}</p> : null}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${style.confirmBg}`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </>
  );
}
