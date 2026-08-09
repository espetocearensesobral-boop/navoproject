import React, { useState } from 'react';
import { Wallet, DollarSign, CreditCard, Activity, TrendingUp } from 'lucide-react';
import { CaixaManagement } from './CaixaManagement';
import { FinancialStatementManagement } from './FinancialStatementManagement';
import { FinancialHealthManagement } from './FinancialHealthManagement';
import { AccountsPayableManagement } from './AccountsPayableManagement';
import { ReportsManagement } from './ReportsManagement';

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
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`shrink-0 h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95 ${
                isActive
                  ? 'bg-gold-base text-surface-base shadow-sm'
                  : 'bg-surface-card text-content-muted border border-border-subtle hover:text-content-base'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo da sub-aba ativa */}
      <div className="animate-fade-in min-w-0">
        {renderSubContent()}
      </div>
    </div>
  );
};
