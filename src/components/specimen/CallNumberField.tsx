import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { validateCallNumber } from '@/utils/callNumber';
import { formControlClass, formLabelClass } from '@/utils/formControl';

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
        <label className={formLabelClass()}>
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
          className={formControlClass({
            error: !!validationError,
            className: `w-full flex-1 pr-10 ${
              isAutoFillMode ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700' : ''
            }`,
          })}
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
