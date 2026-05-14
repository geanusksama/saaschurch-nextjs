import React from 'react';

export type BadgeVariant = 'active' | 'pending' | 'inactive' | 'completed' | 'cancelled' | 'success' | 'error' | 'warning' | 'info';
export type BadgeSize = 'small' | 'medium' | 'large';

export interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  size?: BadgeSize;
  className?: string;
}

export function Badge({ variant, children, size = 'medium', className = '' }: BadgeProps) {
  const variants = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-orange-100 text-orange-700',
    inactive: 'bg-slate-100 text-slate-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    success: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    warning: 'bg-orange-100 text-orange-700',
    info: 'bg-blue-100 text-blue-700',
  };
  
  const sizes = {
    small: 'px-2 py-0.5 text-xs',
    medium: 'px-2.5 py-1 text-xs',
    large: 'px-3 py-1.5 text-sm',
  };
  
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}

export interface StatusBadgeProps {
  status: 'active' | 'pending' | 'inactive' | 'completed' | 'cancelled';
  size?: BadgeSize;
}

export function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const labels = {
    active: 'Ativo',
    pending: 'Pendente',
    inactive: 'Inativo',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  };
  
  return (
    <Badge variant={status} size={size}>
      {labels[status]}
    </Badge>
  );
}
