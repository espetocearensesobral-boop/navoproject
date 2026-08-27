import React from"react";
import { AdminTabs, type AdminTabItem } from"./AdminTabs";

interface AdminWorkspaceProps {
 tabs: AdminTabItem[];
 activeId: string;
 onChange: (id: string) => void;
 children: React.ReactNode;
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
 tabs,
 activeId,
 onChange,
 children,
}) => (
 <div className="space-y-3 min-w-0">
 <AdminTabs
 tabs={tabs}
 activeId={activeId}
 onChange={onChange}
 className="pb-1"
 />
 <div className="min-w-0">{children}</div>
 </div>
);
