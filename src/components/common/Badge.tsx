interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export default function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-900 ring-1 ring-gray-300/70 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-600',
    success: 'bg-green-100 text-green-900 ring-1 ring-green-300/70 dark:bg-green-900/50 dark:text-green-100 dark:ring-green-700/70',
    warning: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300/70 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-700/70',
    danger: 'bg-red-100 text-red-900 ring-1 ring-red-300/70 dark:bg-red-900/50 dark:text-red-100 dark:ring-red-700/70',
    info: 'bg-blue-100 text-blue-900 ring-1 ring-blue-300/70 dark:bg-blue-900/50 dark:text-blue-100 dark:ring-blue-700/70',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
}


