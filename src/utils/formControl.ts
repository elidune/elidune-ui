type FormControlOptions = {
  error?: boolean;
  className?: string;
};

type FormLabelOptions = {
  className?: string;
  /** Set false when the parent already stacks label + control with gap. */
  marginBottom?: boolean;
  /** Use for labels inline in a toolbar row (no block display). */
  inline?: boolean;
};

/** Standard label above a form control — matches `Input` label styling. */
export function formLabelClass({ className = '', marginBottom = true, inline = false }: FormLabelOptions = {}): string {
  return [
    inline ? 'text-sm font-medium text-gray-700 dark:text-gray-300' : 'block text-sm font-medium text-gray-700 dark:text-gray-300',
    marginBottom && !inline ? 'mb-1' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Label inline with a checkbox, radio, or switch. */
export function formChoiceLabelClass(className = ''): string {
  return [
    'flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Shared styling for `<input>` and `<select>` — matches `Input` height, border, and focus ring. */
export function formControlClass({ error = false, className = '' }: FormControlOptions = {}): string {
  return [
    'box-border rounded-lg border bg-white dark:bg-gray-900',
    'h-10 min-h-10 shrink-0 px-4 py-0',
    'text-sm leading-normal',
    'text-gray-900 dark:text-gray-100',
    'placeholder-gray-400 dark:placeholder-gray-500',
    'border-gray-300 dark:border-gray-700',
    'focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/20 dark:focus-visible:ring-amber-500/40',
    'disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 disabled:opacity-50',
    'focus:outline-none',
    error ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Shared styling for `<textarea>` — same border/focus as controls, with vertical padding for multi-line content. */
export function formTextareaClass({ error = false, className = '' }: FormControlOptions = {}): string {
  return [
    'box-border w-full rounded-lg border bg-white dark:bg-gray-900',
    'px-4 py-2.5',
    'text-sm leading-normal',
    'text-gray-900 dark:text-gray-100',
    'placeholder-gray-400 dark:placeholder-gray-500',
    'border-gray-300 dark:border-gray-700',
    'focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/20 dark:focus-visible:ring-amber-500/40',
    'disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 disabled:opacity-50',
    'focus:outline-none resize-y',
    error ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}
