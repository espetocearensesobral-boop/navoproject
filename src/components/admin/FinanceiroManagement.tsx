import React, { useState } from 'react';
import { Wallet, DollarSign, CreditCard, Activity, TrendingUp } from 'lucide-react';
import { CaixaManagement } from './CaixaManagement';
import { FinancialStatementManagement } from './FinancialStatementManagement';
import { FinancialHealthManagement } from './FinancialHealthManagement';
import { AccountsPayableManagement } from './AccountsPayableManagement';
import { ReportsManagement } from './ReportsManagement';
import { AdminTabs } from './shared/AdminTabs';

type FinanceiroSubTab = 'caixa' | 'extrato' | 'pagar' | 'saude' | 'relatorios';

interface FinanceiroManagementProps {
  initialSubTab?: FinanceiroSubTab;
}

const subTabs: { id: FinanceiroSubTab; label: string; icon: React.ElementType }[] = [
  { id: 'caixa', label: 'Caixa', icon: Wallet },
  { id: 'extrato', label: 'Extrato', icon: DollarSign },
  { id: 'pagar', label: 'A Pagar', icon: CreditCard },
  { id: 'saude', label: 'Saúde Financeira', icon: Activity },
  { id: 'relatorios', label: 'Relatórios', icon: TrendingUp },
];

/**
 * Módulo Financeiro unificado.
 *
 * Antes, Caixa / Extrato / Contas a Pagar / Saúde Financeira / Relatórios eram
 * 5 itens separados no menu principal. Isso fragmentava um único assunto
 * ("meu dinheiro") em 5 lugares diferentes. Aqui eles vivem sob um único
 * item de navegação, com abas internas — nenhuma lógica dos componentes
 * originais foi alterada, apenas reorganizada.
 */
export const FinanceiroManagement: React.FC<FinanceiroManagementProps> = ({ initialSubTab = 'caixa' }) => {
  const [subTab, setSubTab] = useState<FinanceiroSubTab>(initialSubTab);

  const renderSubContent = () => {
    switch (subTab) {
      case 'caixa':
        return <CaixaManagement />;
      case 'extrato':
        return <FinancialStatementManagement />;
      case 'pagar':
        return <AccountsPayableManagement />;
      case 'saude':
        return <FinancialHealthManagement />;
      case 'relatorios':
        return <ReportsManagement />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Sub-navegação do módulo Financeiro */}
      <AdminTabs tabs={subTabs} activeId={subTab} onChange={(id) => setSubTab(id as FinanceiroSubTab)} />

      {/* Conteúdo da sub-aba ativa */}
      <div className="animate-fade-in min-w-0">
        {renderSubContent()}
      </div>
    </div>
  );
};
