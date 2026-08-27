import React, { useEffect, useState } from"react";
import { createPortal } from"react-dom";
import { Plus, type LucideIcon } from"lucide-react";

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
 className ="",
 disabled = false,
}) => {
 const [mounted, setMounted] = useState(false);

 useEffect(() => {
 setMounted(true);
 }, []);

 if (!mounted || typeof document ==="undefined") {
 return null;
 }

 const fabButton = (
 <button
 id={id || `admin-fab-${label.toLowerCase().replace(/\s+/g,"-")}`}
 type="button"
 onClick={onClick}
 disabled={disabled}
 title={label}
 aria-label={label}
 style={{
 position:"fixed",
 }}
 className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-5 md:bottom-8 md:right-8 z-30 group flex items-center justify-center h-14 w-14 hover:w-auto hover:px-5 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] rounded-[var(--admin-radius-full)] shadow-[0_8px_25px_rgba(0,0,0,0.35)] hover:shadow-[0_10px_35px_rgba(212,175,55,0.5)] active:scale-95 transition-all duration-300 ease-out cursor-pointer overflow-hidden border border-status-warning/30 select-none ${
 disabled ?"opacity-50 cursor-not-allowed pointer-events-none":""
 } ${className}`}
 >
 <Icon className="w-6 h-6 shrink-0 transition-transform duration-300 group-hover:rotate-90"/>
 <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap font-bold text-xs pl-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:pl-2 transition-all duration-300 ease-out">
 {label}
 </span>
 </button>
 );

 return createPortal(fabButton, document.body);
};
