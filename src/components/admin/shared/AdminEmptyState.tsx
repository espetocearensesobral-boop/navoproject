import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "../../ui/Button";

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
    className="admin-empty-state flex flex-col items-center justify-center gap-2 rounded-[var(--admin-radius-xl)] border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-10 text-center animate-fade-in"
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-[var(--admin-radius-xl)] bg-[var(--admin-bg)] text-[var(--admin-text-muted)]">
      <Icon className="h-6 w-6" aria-hidden="true" />
    </div>
    <h3 className="admin-copy-title mt-1 text-sm font-bold text-[var(--admin-text-main)]">
      {title}
    </h3>
    <p className="admin-copy-description max-w-sm text-xs leading-relaxed text-[var(--admin-text-muted)]">
      {description}
    </p>
    {actionLabel && onAction && (
      <Button type="button" size="sm" className="mt-2" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);
