import React, { useState } from 'react';
import { Wallet, DollarSign, ArrowDownRight, TrendingUp } from 'lucide-react';
import { ReceiptsManagement } from './ReceiptsManagement';
import { FinancialStatementManagement } from './FinancialStatementManagement';
import { ExpensesManagement } from './ExpensesManagement';
import { ReportsManagement } from './ReportsManagement';
import { AdminTabs } from './shared/AdminTabs';

type FinanceiroSubTab = 'recebimentos' | 'extrato' | 'saidas' | 'relatorios';

interface FinanceiroManagementProps {
  initialSubTab?: FinanceiroSubTab;
}

const subTabs: { id: FinanceiroSubTab; label: string; icon: React.ElementType }[] = [
  { id: 'recebimentos', label: 'Recebimentos', icon: Wallet },
  { id: 'extrato', label: 'Extrato real', icon: DollarSign },
  { id: 'saidas', label: 'Saídas', icon: ArrowDownRight },
  { id: 'relatorios', label: 'Relatórios', icon: TrendingUp },
];

/**
 * Módulo Financeiro unificado.
 *
 * A operação financeira permanece em uma única área. Recebimentos e saídas
 * usam o mesmo livro-caixa persistido do Extrato; Relatórios apenas consolidam
 * esses registros reais, sem indicadores demonstrativos ou dados locais.
 */
export const FinanceiroManagement: React.FC<FinanceiroManagementProps> = ({ initialSubTab = 'recebimentos' }) => {
  const [subTab, setSubTab] = useState<FinanceiroSubTab>(initialSubTab);

  const renderSubContent = () => {
    switch (subTab) {
      case 'recebimentos':
        return <ReceiptsManagement />;
      case 'extrato':
        return <FinancialStatementManagement />;
      case 'saidas':
        return <ExpensesManagement />;
      case 'relatorios':
        return <ReportsManagement />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      <AdminTabs tabs={subTabs} activeId={subTab} onChange={(id) => setSubTab(id as FinanceiroSubTab)} />


      <div className="animate-fade-in min-w-0">
        {renderSubContent()}
      </div>
    </div>
  );
};
