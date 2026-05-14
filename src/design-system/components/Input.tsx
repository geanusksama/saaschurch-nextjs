import React from 'react';
import { Eye, EyeOff, Search } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  icon,
  className = '',
  disabled,
  ...props
}: InputProps) {
  const baseStyles = 'w-full px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1';
  
  const stateStyles = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : 'border-slate-300 focus:border-purple-500 focus:ring-purple-500';
  
  const disabledStyles = disabled ? 'bg-slate-100 cursor-not-allowed' : 'bg-white';
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        <input
          className={`${baseStyles} ${stateStyles} ${disabledStyles} ${icon ? 'pl-10' : ''} ${className}`}
          disabled={disabled}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-sm text-slate-500">{helperText}</p>
      )}
    </div>
  );
}

export function EmailInput(props: Omit<InputProps, 'type'>) {
  return <Input type="email" {...props} />;
}

export function PhoneInput(props: Omit<InputProps, 'type'>) {
  return <Input type="tel" {...props} />;
}

export function PasswordInput({ ...props }: Omit<InputProps, 'type'>) {
  const [showPassword, setShowPassword] = React.useState(false);
  
  return (
    <div className="relative">
      <Input
        type={showPassword ? 'text' : 'password'}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-[38px] -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        tabIndex={-1}
      >
        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}

export function SearchInput({ ...props }: Omit<InputProps, 'type' | 'icon'>) {
  return (
    <Input
      type="search"
      icon={<Search className="w-5 h-5" />}
      {...props}
    />
  );
}
