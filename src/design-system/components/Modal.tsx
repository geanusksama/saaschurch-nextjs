import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  showCloseButton?: boolean;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'medium',
  showCloseButton = true 
}: ModalProps) {
  const sizes = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
  };
  
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative bg-white rounded-xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export interface FormModalProps extends Omit<ModalProps, 'children'> {
  children: React.ReactNode;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
}

export function FormModal({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  onCancel,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  isSubmitting = false,
  size = 'medium',
}: FormModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <div className="space-y-4 mb-6">
          {children}
        </div>
        
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isConfirming?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'warning',
  isConfirming = false,
}: ConfirmationModalProps) {
  const variantConfig = {
    danger: {
      icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
      iconBg: 'bg-red-100',
      buttonVariant: 'danger' as const,
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-orange-600" />,
      iconBg: 'bg-orange-100',
      buttonVariant: 'primary' as const,
    },
    info: {
      icon: <AlertTriangle className="w-6 h-6 text-blue-600" />,
      iconBg: 'bg-blue-100',
      buttonVariant: 'primary' as const,
    },
  };
  
  const config = variantConfig[variant];
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small" showCloseButton={false}>
      <div className="space-y-4">
        <div className={`w-12 h-12 ${config.iconBg} rounded-full flex items-center justify-center mx-auto`}>
          {config.icon}
        </div>
        
        <p className="text-center text-slate-600">
          {message}
        </p>
        
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isConfirming}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={config.buttonVariant}
            onClick={onConfirm}
            loading={isConfirming}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
