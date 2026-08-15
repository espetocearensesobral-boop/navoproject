import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
}) => {
  const variantClasses = {
    success: 'bg-status-success/10 text-status-success border-status-success/20',
    warning: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    error: 'bg-status-error/10 text-status-error border-status-error/20',
    info: 'bg-status-info/10 text-status-info border-status-info/20',
    default: 'bg-white/5 text-content-muted border-border-subtle',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-[11px] leading-4',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span className={`
      inline-flex items-center font-bold rounded-full border
      ${variantClasses[variant]}
      ${sizeClasses[size]}
    `}>
      {children}
    </span>
  );
};
