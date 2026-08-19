import React, { useState } from 'react';
import { Award, Cake, Gift, History, MessageSquare, Users } from 'lucide-react';
import { NavoRewardsAdmin } from './NavoRewardsAdmin';
import { FollowUpManagement } from './FollowUpManagement';
import { BirthdaysManagement } from './BirthdaysManagement';
import { AdminWorkspace } from './shared/AdminWorkspace';

type RelationshipTab = 'overview' | 'loyalty' | 'reviews' | 'followup' | 'birthdays' | 'referrals' | 'rewards';

export const RelationshipWorkspace: React.FC<{ initialTab?: RelationshipTab }> = ({ initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<RelationshipTab>(initialTab);

  const renderContent = () => {
    if (activeTab === 'followup') return <FollowUpManagement />;
    if (activeTab === 'birthdays') return <BirthdaysManagement />;
    return (
      <NavoRewardsAdmin
        initialTab={activeTab === 'overview' ? 'dashboard' : activeTab}
      />
    );
  };

  return (
    <AdminWorkspace
      tabs={[
        { id: 'overview', label: 'Visão geral', icon: Award },
        { id: 'loyalty', label: 'Fidelidade', icon: Award },
        { id: 'reviews', label: 'Avaliações', icon: MessageSquare },
        { id: 'followup', label: 'Follow-up', icon: History },
        { id: 'birthdays', label: 'Aniversários', icon: Cake },
        { id: 'referrals', label: 'Indicações', icon: Users },
        { id: 'rewards', label: 'Prêmios', icon: Gift },
      ]}
      activeId={activeTab}
      onChange={(id) => setActiveTab(id as RelationshipTab)}
    >
      {renderContent()}
    </AdminWorkspace>
  );
};
