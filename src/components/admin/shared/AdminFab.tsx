import React from "react";
import { Plus, type LucideIcon } from "lucide-react";

interface AdminFabProps {
  onClick: () => void;
  label: string;
  icon?: LucideIcon;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export const AdminFab: React.FC<AdminFabProps> = ({
  onClick,
  label,
  icon: Icon = Plus,
  id,
  className = "",
  disabled = false,
}) => {
  return (
    <button
      id={id || `admin-fab-${label.toLowerCase().replace(/\s+/g, "-")}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`fixed bottom-6 right-6 z-40 group flex items-center justify-center h-14 w-14 hover:w-auto hover:px-5 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] rounded-full shadow-2xl hover:shadow-[0_10px_30px_rgba(212,175,55,0.45)] active:scale-95 transition-all duration-300 ease-out cursor-pointer overflow-hidden border border-amber-200/40 select-none ${
        disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
      } ${className}`}
    >
      <Icon className="w-6 h-6 shrink-0 transition-transform duration-300 group-hover:rotate-90" />
      <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap font-bold text-xs pl-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:pl-2 transition-all duration-300 ease-out">
        {label}
      </span>
    </button>
  );
};
