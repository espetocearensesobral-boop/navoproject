import React, { useState } from 'react';
import { FileText, TrendingUp } from 'lucide-react';
import { OperationalReportsManagement } from './OperationalReportsManagement';
import { ReportsManagement } from './ReportsManagement';
import { AdminWorkspace } from './shared/AdminWorkspace';

type ReportsTab = 'operational' | 'financial';

export const ReportsWorkspace: React.FC<{ initialTab?: ReportsTab }> = ({ initialTab = 'operational' }) => {
  const [activeTab, setActiveTab] = useState<ReportsTab>(initialTab);

  return (
    <div className="space-y-3 min-w-0">
      <AdminWorkspace
        tabs={[
          { id: 'operational', label: 'Operação', icon: FileText },
          { id: 'financial', label: 'Financeiro', icon: TrendingUp },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as ReportsTab)}
      >
        {activeTab === 'operational' ? <OperationalReportsManagement /> : <ReportsManagement />}
      </AdminWorkspace>
    </div>
  );
};
