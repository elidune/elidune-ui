import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  submitMode?: boolean;
  onSubmit?: (value: string) => void;
  showSubmitButton?: boolean;
  submitLabel?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder,
  debounceMs = 300,
  submitMode = false,
  onSubmit,
  showSubmitButton = false,
  submitLabel,
}: SearchInputProps) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(value);
  const effectivePlaceholder = placeholder ?? t('common.search');
  const effectiveSubmitLabel = submitLabel ?? t('common.search');

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const debouncedOnChange = useCallback(
    debounce((val: string) => {
      onChange(val);
    }, debounceMs),
    [onChange, debounceMs]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (!submitMode) debouncedOnChange(newValue);
    else onChange(newValue);
  };

  const handleSubmit = () => {
    if (!submitMode) return;
    onSubmit?.(localValue);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    if (submitMode) onSubmit?.('');
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (submitMode && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={effectivePlaceholder}
        aria-label={effectivePlaceholder}
        className={`w-full pl-10 ${localValue ? 'pr-10' : 'pr-4'} ${showSubmitButton ? 'sm:pr-28 pr-24' : ''} py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/20`}
      />
      {showSubmitButton && (
        <button
          type="button"
          onClick={handleSubmit}
          aria-label={effectiveSubmitLabel}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!submitMode}
        >
          {effectiveSubmitLabel}
        </button>
      )}
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t('common.clear')}
          className={`absolute ${showSubmitButton ? 'right-24 sm:right-28' : 'right-3'} top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900`}
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      )}
    </div>
  );
}

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}


