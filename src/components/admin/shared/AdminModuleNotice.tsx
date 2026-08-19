import React from 'react';
import { Database, LockKeyhole } from 'lucide-react';

interface AdminModuleNoticeProps {
  title: string;
  description: string;
  detail?: string;
}

export const AdminModuleNotice: React.FC<AdminModuleNoticeProps> = ({ title, description, detail }) => (
  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 sm:p-5 text-content-base">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
        <LockKeyhole className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="admin-copy-title text-sm font-bold text-content-base">{title}</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-300">
            <Database className="w-3 h-3" /> Em configuração
          </span>
        </div>
        <p className="admin-copy-description mt-1 text-xs leading-relaxed text-content-muted">{description}</p>
        {detail && <p className="admin-copy-description mt-2 text-xs leading-relaxed text-amber-200/80">{detail}</p>}
      </div>
    </div>
  </div>
);

export default AdminModuleNotice;
