import React from 'react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading = false,
  loadingText = 'Processando...',
  variant = 'primary',
  size = 'md',
  children,
  disabled,
  className = '',
  ...props
}) => {
  const variants = {
    primary: 'bg-accent-solid text-on-accent hover:bg-accent-strong shadow-md',
    secondary: 'bg-content-base/5 text-content-base border border-border-subtle hover:bg-content-base/10',
    danger: 'bg-status-error/10 text-status-error border border-status-error/30 hover:bg-status-error/20',
    ghost: 'text-content-muted hover:text-content-base hover:bg-content-base/5',
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs gap-1.5',
    md: 'px-6 py-3 text-sm gap-2',
    lg: 'px-8 py-4 text-base gap-2.5',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center font-bold rounded-xl
        transition-all duration-200 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle 
              className="opacity-25" 
              cx="12" cy="12" r="10" 
              stroke="currentColor" strokeWidth="4"
            />
            <path 
              className="opacity-90" 
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
