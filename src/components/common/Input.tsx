import { forwardRef, InputHTMLAttributes, ReactNode, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  /** Renders inside the field on the right (e.g. password visibility toggle). */
  rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className = '', required, ...props }, ref) => {
    const generatedId = useId();
    const inputId = props.id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
            {required && (
              <span className="text-red-600 dark:text-red-400 ml-0.5 font-medium" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            className={`
              w-full rounded-lg border bg-white dark:bg-gray-900 box-border
              h-10 min-h-10 shrink-0
              ${leftIcon ? 'pl-10' : 'pl-4'} ${rightIcon ? 'pr-10' : 'pr-4'}
              py-0 text-sm leading-normal
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              border-gray-300 dark:border-gray-700
              focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/20 dark:focus-visible:ring-amber-500/40
              disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500
              ${error ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' : ''}
              ${className}
            `}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">{rightIcon}</div>
          )}
        </div>
        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;


