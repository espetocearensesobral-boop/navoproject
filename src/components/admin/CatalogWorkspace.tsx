import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Package, Scissors, Users } from 'lucide-react';
import { ServicesManagement } from './ServicesManagement';
import { ProfessionalsManagement } from './ProfessionalsManagement';
import { ProductsManagement } from './ProductsManagement';
import { AdminPageHeader } from './shared/AdminPageHeader';

type CatalogTab = 'services' | 'professionals' | 'products';
type CatalogGroupId = 'service-catalog' | 'product-catalog';

type CatalogOption = { id: CatalogTab; label: string; description: string; icon: React.ElementType };
type CatalogGroup = { id: CatalogGroupId; label: string; summary: string; icon: React.ElementType; options: CatalogOption[] };

const groups: CatalogGroup[] = [
  {
    id: 'service-catalog',
    label: 'Catálogo de atendimento',
    summary: 'Serviços, profissionais e disponibilidade para agendamento',
    icon: Scissors,
    options: [
      { id: 'services', label: 'Serviços', description: 'Preços, duração e regras dos atendimentos', icon: Scissors },
      { id: 'professionals', label: 'Profissionais', description: 'Equipe, especialidades e agenda individual', icon: Users },
    ],
  },
  {
    id: 'product-catalog',
    label: 'Produtos e estoque',
    summary: 'Itens comercializados e controle de estoque',
    icon: Package,
    options: [
      { id: 'products', label: 'Produtos e estoque', description: 'Cadastro, preços, quantidade e movimentações', icon: Package },
    ],
  },
];

const groupForTab = (tab: CatalogTab): CatalogGroupId => groups.find((group) => group.options.some((option) => option.id === tab))?.id || 'service-catalog';

export const CatalogWorkspace: React.FC<{ initialTab?: CatalogTab }> = ({ initialTab = 'services' }) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>(initialTab);
  const [openGroup, setOpenGroup] = useState<CatalogGroupId | null>(() => initialTab === 'services' ? null : groupForTab(initialTab as CatalogTab));

  useEffect(() => {
    setActiveTab(initialTab);
    setOpenGroup(initialTab === 'services' ? null : groupForTab(initialTab as CatalogTab));
  }, [initialTab]);

  const activeOption = useMemo(() => groups.flatMap((group) => group.options).find((option) => option.id === activeTab), [activeTab]);

  const selectOption = (groupId: CatalogGroupId, tab: CatalogTab) => {
    setOpenGroup(groupId);
    setActiveTab(tab);
  };

  const renderContent = () => {
    if (activeTab === 'services') return <ServicesManagement />;
    if (activeTab === 'professionals') return <ProfessionalsManagement />;
    return <ProductsManagement />;
  };

  return (
    <div className="admin-catalog-workspace min-w-0 space-y-4">
      <AdminPageHeader icon={Package} title="Catálogo" stats={[{ label: 'seção', value: activeOption?.label || 'Serviços' }]} />

      <div className="space-y-3" aria-label="Seções do catálogo">
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

              {isOpen && <div className="border-t border-border-subtle px-3 pb-4 pt-3 sm:px-4 sm:pb-5"><div className="grid gap-2 sm:grid-cols-2">{group.options.map((option) => { const OptionIcon = option.icon; const isActive = activeTab === option.id; return <button key={option.id} type="button" onClick={() => selectOption(group.id, option.id)} aria-current={isActive ? 'page' : undefined} className={`flex min-h-[64px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${isActive ? 'border-gold-base/40 bg-gold-base/10' : 'border-border-subtle bg-surface-base hover:border-border-strong hover:bg-surface-card'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-gold-base/15 text-gold-base' : 'bg-surface-card text-content-muted'}`}><OptionIcon className="h-4 w-4" /></span><span className="min-w-0"><span className={`block truncate text-xs font-bold ${isActive ? 'text-gold-base' : 'text-content-base'}`}>{option.label}</span><span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-content-muted">{option.description}</span></span></button>; })}</div><div className="mt-4 border-t border-border-subtle pt-4">{renderContent()}</div></div>}
            </section>
          );
        })}
      </div>
    </div>
  );
};
