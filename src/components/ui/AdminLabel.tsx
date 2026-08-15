import React from 'react';

interface AdminLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  uppercase?: boolean;
  tone?: 'default' | 'muted' | 'accent';
  children: React.ReactNode;
}

export const AdminLabel: React.FC<AdminLabelProps> = ({
  uppercase = false,
  tone = 'default',
  className = '',
  children,
  ...props
}) => {
  const toneClass = {
    default: 'text-content-base',
    muted: 'text-content-muted',
    accent: 'text-gold-hover',
  }[tone];

  return (
    <label
      className={`block text-xs font-semibold leading-5 mb-1 ${toneClass} ${uppercase ? 'uppercase tracking-wide' : ''} ${className}`}
      {...props}
    >
      {children}
    </label>
  );
};
