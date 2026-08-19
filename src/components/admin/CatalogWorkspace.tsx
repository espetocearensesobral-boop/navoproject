import React, { useState } from 'react';
import { Package, Scissors, Users } from 'lucide-react';
import { ServicesManagement } from './ServicesManagement';
import { ProfessionalsManagement } from './ProfessionalsManagement';
import { ProductsManagement } from './ProductsManagement';
import { AdminWorkspace } from './shared/AdminWorkspace';

type CatalogTab = 'services' | 'professionals' | 'products';

export const CatalogWorkspace: React.FC<{ initialTab?: CatalogTab }> = ({ initialTab = 'services' }) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>(initialTab);

  return (
    <AdminWorkspace
      tabs={[
        { id: 'services', label: 'Serviços', icon: Scissors },
        { id: 'professionals', label: 'Profissionais', icon: Users },
        { id: 'products', label: 'Produtos e estoque', icon: Package },
      ]}
      activeId={activeTab}
      onChange={(id) => setActiveTab(id as CatalogTab)}
    >
      {activeTab === 'services' && <ServicesManagement />}
      {activeTab === 'professionals' && <ProfessionalsManagement />}
      {activeTab === 'products' && <ProductsManagement />}
    </AdminWorkspace>
  );
};
