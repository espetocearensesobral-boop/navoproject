import React, { useEffect, useMemo, useState } from 'react';
import { Award, Cake, ChevronDown, Gift, History, LayoutDashboard, MessageSquare, Star, Users, UserRound } from 'lucide-react';
import { NavoRewardsAdmin } from './NavoRewardsAdmin';
import { FollowUpManagement } from './FollowUpManagement';
import { BirthdaysManagement } from './BirthdaysManagement';
import { AdminPageHeader } from './shared/AdminPageHeader';

type RelationshipTab = 'overview' | 'loyalty' | 'reviews' | 'followup' | 'birthdays' | 'referrals' | 'rewards';
type RelationshipGroupId = 'relationship' | 'retention' | 'care';

type RelationshipOption = { id: RelationshipTab; label: string; description: string; icon: React.ElementType };
type RelationshipGroup = { id: RelationshipGroupId; label: string; summary: string; icon: React.ElementType; options: RelationshipOption[] };

const groups: RelationshipGroup[] = [
  {
    id: 'relationship',
    label: 'Relacionamento com clientes',
    summary: 'Visão geral, avaliações e acompanhamento da base',
    icon: Users,
    options: [
      { id: 'overview', label: 'Visão geral', description: 'Indicadores de relacionamento e NPS', icon: LayoutDashboard },
      { id: 'reviews', label: 'Avaliações', description: 'Avaliações, NPS e tratamento de feedbacks', icon: Star },
      { id: 'followup', label: 'Follow-up', description: 'Acompanhe clientes após os atendimentos', icon: History },
    ],
  },
  {
    id: 'retention',
    label: 'Fidelização e benefícios',
    summary: 'Clube, níveis, prêmios e indicações',
    icon: Award,
    options: [
      { id: 'loyalty', label: 'Fidelidade', description: 'Pontos, níveis e regras do clube', icon: Award },
      { id: 'rewards', label: 'Prêmios', description: 'Benefícios, cupons e catálogo de recompensas', icon: Gift },
      { id: 'referrals', label: 'Indicações', description: 'Links, bônus e motor de indicação', icon: UserRound },
    ],
  },
  {
    id: 'care',
    label: 'Cuidado e recorrência',
    summary: 'Aniversários e contatos de relacionamento',
    icon: Cake,
    options: [
      { id: 'birthdays', label: 'Aniversários', description: 'Clientes aniversariantes e mensagens', icon: Cake },
    ],
  },
];

const groupForTab = (tab: RelationshipTab): RelationshipGroupId => groups.find((group) => group.options.some((option) => option.id === tab))?.id || 'relationship';

export const RelationshipWorkspace: React.FC<{ initialTab?: RelationshipTab }> = ({ initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<RelationshipTab>(initialTab);
  const [openGroup, setOpenGroup] = useState<RelationshipGroupId | null>(() => groupForTab(initialTab as RelationshipTab));

  useEffect(() => {
    setActiveTab(initialTab);
    setOpenGroup(groupForTab(initialTab as RelationshipTab));
  }, [initialTab]);

  const activeOption = useMemo(() => groups.flatMap((group) => group.options).find((option) => option.id === activeTab), [activeTab]);

  const selectOption = (groupId: RelationshipGroupId, tab: RelationshipTab) => {
    setOpenGroup(groupId);
    setActiveTab(tab);
  };

  const renderContent = () => {
    if (activeTab === 'followup') return <FollowUpManagement />;
    if (activeTab === 'birthdays') return <BirthdaysManagement />;
    return <NavoRewardsAdmin initialTab={activeTab === 'overview' ? 'dashboard' : activeTab} />;
  };

  return (
    <div className="admin-relationship-workspace min-w-0 space-y-4">
      <AdminPageHeader icon={Users} title="Relacionamento" stats={[{ label: 'seção', value: activeOption?.label || 'Visão geral' }]} />

      <div className="space-y-3" aria-label="Seções de relacionamento">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroup === group.id;
          return (
            <section key={group.id} className={`overflow-hidden rounded-xl border bg-surface-card transition-colors ${isOpen ? 'border-gold-base/40' : 'border-border-subtle'}`}>
              <button type="button" onClick={() => setOpenGroup((current) => current === group.id ? null : group.id)} aria-expanded={isOpen} className="flex min-h-[74px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-base sm:px-5">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOpen ? 'bg-gold-base/10 text-gold-base' : 'bg-surface-base text-content-muted'}`}><GroupIcon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-content-base sm:text-[15px]">{group.label}</span><span className="mt-0.5 block truncate text-xs text-content-muted">{group.summary}</span></span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-content-muted transition-transform duration-200 ${isOpen ? 'rotate-180 text-gold-base' : ''}`} />
              </button>

              {isOpen && <div className="border-t border-border-subtle px-3 pb-4 pt-3 sm:px-4 sm:pb-5"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{group.options.map((option) => { const OptionIcon = option.icon; const isActive = activeTab === option.id; return <button key={`${group.id}-${option.id}`} type="button" onClick={() => selectOption(group.id, option.id)} aria-current={isActive ? 'page' : undefined} className={`flex min-h-[64px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${isActive ? 'border-gold-base/40 bg-gold-base/10' : 'border-border-subtle bg-surface-base hover:border-border-strong hover:bg-surface-card'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-gold-base/15 text-gold-base' : 'bg-surface-card text-content-muted'}`}><OptionIcon className="h-4 w-4" /></span><span className="min-w-0"><span className={`block truncate text-xs font-bold ${isActive ? 'text-gold-base' : 'text-content-base'}`}>{option.label}</span><span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-content-muted">{option.description}</span></span></button>; })}</div><div className="mt-4 border-t border-border-subtle pt-4">{renderContent()}</div></div>}
            </section>
          );
        })}
      </div>
    </div>
  );
};
