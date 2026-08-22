import React, { useState } from 'react';
import { CalendarDays, Globe2, Mail, Megaphone, Printer, QrCode, Settings, ShieldCheck, Store } from 'lucide-react';
import { BarbershopProfileManagement } from './BarbershopProfileManagement';
import { SettingsManagement, type SettingsTab } from './SettingsManagement';
import { AdminWorkspace } from './shared/AdminWorkspace';

type SystemTab = 'unit' | 'preferences' | 'availability' | 'notifications' | 'qrcode' | 'print' | 'audit' | 'meta_ads' | 'google_ads';

export const SystemWorkspace: React.FC<{ initialTab?: SystemTab; onOpenCampaigns?: (provider?: 'meta' | 'google') => void }> = ({ initialTab = 'unit', onOpenCampaigns }) => {
  const [activeTab, setActiveTab] = useState<SystemTab>(initialTab);

  const renderContent = () => {
    if (activeTab === 'unit') return <BarbershopProfileManagement />;
    const settingsTab: SettingsTab = activeTab === 'preferences'
      ? 'email'
      : activeTab === 'notifications'
        ? 'whatsapp'
        : activeTab === 'meta_ads'
          ? 'meta_ads'
          : activeTab === 'google_ads'
            ? 'google_ads'
            : activeTab;
    return <SettingsManagement initialTab={settingsTab} hideTabs onOpenCampaigns={onOpenCampaigns} />;
  };

  return (
    <div className="admin-system-workspace">
      <AdminWorkspace
        tabs={[
        { id: 'unit', label: 'Unidade', icon: Store },
        { id: 'preferences', label: 'Preferências', icon: Settings },
        { id: 'availability', label: 'Agenda', icon: CalendarDays },
        { id: 'notifications', label: 'Notificações', icon: Mail },
        { id: 'meta_ads', label: 'Meta Ads', icon: Megaphone },
        { id: 'google_ads', label: 'Google Ads', icon: Globe2 },
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
