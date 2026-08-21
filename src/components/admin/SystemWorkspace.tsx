import React, { useState } from 'react';
import { CalendarDays, Mail, Printer, QrCode, Settings, ShieldCheck, Store } from 'lucide-react';
import { BarbershopProfileManagement } from './BarbershopProfileManagement';
import { SettingsManagement, type SettingsTab } from './SettingsManagement';
import { AdminWorkspace } from './shared/AdminWorkspace';

type SystemTab = 'unit' | 'preferences' | 'availability' | 'notifications' | 'qrcode' | 'print' | 'audit';

export const SystemWorkspace: React.FC<{ initialTab?: SystemTab }> = ({ initialTab = 'unit' }) => {
  const [activeTab, setActiveTab] = useState<SystemTab>(initialTab);

  const renderContent = () => {
    if (activeTab === 'unit') return <BarbershopProfileManagement />;
    const settingsTab: SettingsTab = activeTab === 'preferences'
      ? 'email'
      : activeTab === 'notifications'
        ? 'whatsapp'
        : activeTab;
    return <SettingsManagement initialTab={settingsTab} hideTabs />;
  };

  return (
    <div className="admin-system-workspace">
      <AdminWorkspace
        tabs={[
        { id: 'unit', label: 'Unidade', icon: Store },
        { id: 'preferences', label: 'Preferências', icon: Settings },
        { id: 'availability', label: 'Agenda', icon: CalendarDays },
        { id: 'notifications', label: 'Notificações', icon: Mail },
        { id: 'qrcode', label: 'QR Code', icon: QrCode },
        { id: 'print', label: 'Impressões', icon: Printer },
        { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
      ]}
      activeId={activeTab}
      onChange={(id) => setActiveTab(id as SystemTab)}
    >
        {renderContent()}
      </AdminWorkspace>
    </div>
  );
};
