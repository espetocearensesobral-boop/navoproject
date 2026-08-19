import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '../../ui/Button';

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div
    role="status"
    className="admin-empty-state flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-subtle bg-surface-card px-5 py-10 text-center animate-fade-in"
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-base text-content-muted">
      <Icon className="h-6 w-6" aria-hidden="true" />
    </div>
    <h3 className="admin-copy-title mt-1 text-sm font-bold text-content-base">{title}</h3>
    <p className="admin-copy-description max-w-sm text-xs leading-relaxed text-content-muted">{description}</p>
    {actionLabel && onAction && (
      <Button type="button" size="sm" className="mt-2" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);
