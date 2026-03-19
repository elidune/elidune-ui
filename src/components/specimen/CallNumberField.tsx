import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { validateCallNumber } from '@/utils/callNumber';

interface CallNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  suggestedValue?: string | null;
  label?: string;
  placeholder?: string;
  excludeSpecimenId?: string;
  disabled?: boolean;
  inputId?: string;
}

export default function CallNumberField({
  value,
  onChange,
  suggestedValue,
  label,
  placeholder,
  disabled,
  inputId,
}: CallNumberFieldProps) {
  const { t } = useTranslation();
  const [isManual, setIsManual] = useState(false);

  const isAutoFillMode = !isManual && suggestedValue != null && suggestedValue !== '';
  const displayValue = value;

  const validationError =
    displayValue !== '' && !validateCallNumber(displayValue)
      ? t('items.callNumberInvalid')
      : undefined;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next);
    if (suggestedValue != null && next !== suggestedValue) {
      setIsManual(true);
    }
  };

  const handleResetToSuggestion = () => {
    if (suggestedValue != null) {
      onChange(suggestedValue);
      setIsManual(false);
    }
  };

  const showAutofillButton =
    suggestedValue != null && suggestedValue !== '' && (value === '' || isManual) && !disabled;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          value={displayValue}
          onChange={handleChange}
          onBlur={() => {}}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full rounded-lg border flex-1
            pl-4 pr-10 py-2.5
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            border-gray-300 dark:border-gray-700
            focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/40
            disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500
            ${validationError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
            ${isAutoFillMode ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700' : 'bg-white dark:bg-gray-900'}
          `}
        />
        {showAutofillButton && (
          <button
            type="button"
            onClick={handleResetToSuggestion}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            title={value === '' ? t('items.fillCallNumber') : t('items.resetCallNumber')}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
      {validationError && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationError}</p>
      )}
    </div>
  );
}
