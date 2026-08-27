import React from"react";
import { Database, LockKeyhole } from"lucide-react";

interface AdminModuleNoticeProps {
 title: string;
 description: string;
 detail?: string;
}

export const AdminModuleNotice: React.FC<AdminModuleNoticeProps> = ({
 title,
 description,
 detail,
}) => (
 <div className="rounded-[var(--admin-radius-xl)] border border-status-warning/30 bg-status-warning/10 p-4 sm:p-5 text-[var(--admin-text-main)]">
 <div className="flex items-start gap-3">
 <div className="w-9 h-9 rounded-[var(--admin-radius-lg)] bg-status-warning/10 text-status-warning flex items-center justify-center shrink-0">
 <LockKeyhole className="w-4 h-4"/>
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h2 className="admin-copy-title text-sm font-bold text-[var(--admin-text-main)]">
 {title}
 </h2>
 <span className="inline-flex items-center gap-1 rounded-[var(--admin-radius-full)] border border-status-warning/30 bg-amber-400/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-status-warning">
 <Database className="w-3 h-3"/> Em configuração
 </span>
 </div>
 <p className="admin-copy-description mt-1 text-xs leading-relaxed text-[var(--admin-text-muted)]">
 {description}
 </p>
 {detail && (
 <p className="admin-copy-description mt-2 text-xs leading-relaxed text-status-warning/80">
 {detail}
 </p>
 )}
 </div>
 </div>
 </div>
);

export default AdminModuleNotice;
