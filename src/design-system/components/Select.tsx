import React from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  error,
  helperText,
  disabled = false,
  multiple = false,
  searchable = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const selectedOptions = React.useMemo(() => {
    if (multiple && Array.isArray(value)) {
      return options.filter(opt => value.includes(opt.value));
    }
    if (!multiple && typeof value === 'string') {
      return options.find(opt => opt.value === value);
    }
    return null;
  }, [value, options, multiple]);
  
  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchTerm) return options;
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, searchable]);
  
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelect = (optionValue: string) => {
    if (multiple && Array.isArray(value)) {
      const newValue = value.includes(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue];
      onChange?.(newValue);
    } else {
      onChange?.(optionValue);
      setIsOpen(false);
      setSearchTerm('');
    }
  };
  
  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple && Array.isArray(value)) {
      onChange?.(value.filter(v => v !== optionValue));
    }
  };
  
  const displayText = () => {
    if (multiple && Array.isArray(selectedOptions) && selectedOptions.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map(opt => (
            <span 
              key={opt.value}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm"
            >
              {opt.label}
              <button
                onClick={(e) => handleRemove(opt.value, e)}
                className="hover:text-purple-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      );
    }
    if (!multiple && selectedOptions && typeof selectedOptions === 'object') {
      return selectedOptions.label;
    }
    return <span className="text-slate-400">{placeholder}</span>;
  };
  
  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 text-left flex items-center justify-between ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-slate-300 focus:border-purple-500 focus:ring-purple-500'
          } ${disabled ? 'bg-slate-100 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
          disabled={disabled}
        >
          <div className="flex-1 min-w-0">
            {displayText()}
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
            {searchable && (
              <div className="p-2 border-b border-slate-200">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            
            <div className="overflow-y-auto max-h-48">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                  Nenhuma opção encontrada
                </div>
              ) : (
                filteredOptions.map(option => {
                  const isSelected = multiple && Array.isArray(value)
                    ? value.includes(option.value)
                    : value === option.value;
                  
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-purple-50 text-purple-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
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
