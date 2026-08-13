import React, { useState } from 'react';
import { Wallet, DollarSign, CreditCard, Activity, TrendingUp } from 'lucide-react';
import { CaixaManagement } from './CaixaManagement';
import { PdvInteligente } from './PdvInteligente';
import { FinancialStatementManagement } from './FinancialStatementManagement';
import { FinancialHealthManagement } from './FinancialHealthManagement';
import { AccountsPayableManagement } from './AccountsPayableManagement';
import { ReportsManagement } from './ReportsManagement';
import { AdminTabs } from './shared/AdminTabs';
import { AdminModuleNotice } from './shared/AdminModuleNotice';

type FinanceiroSubTab = 'extrato' | 'pdv' | 'caixa' | 'pagar' | 'saude' | 'relatorios';

interface FinanceiroManagementProps {
  initialSubTab?: FinanceiroSubTab;
}

const subTabs: { id: FinanceiroSubTab; label: string; icon: React.ElementType; disabled?: boolean }[] = [
  { id: 'extrato', label: 'Extrato real', icon: DollarSign },
  { id: 'pdv', label: 'PDV', icon: Wallet },
  { id: 'caixa', label: 'Caixa', icon: Wallet, disabled: true },
  { id: 'pagar', label: 'A Pagar', icon: CreditCard, disabled: true },
  { id: 'saude', label: 'Saúde', icon: Activity, disabled: true },
  { id: 'relatorios', label: 'Relatórios', icon: TrendingUp, disabled: true },
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
export const FinanceiroManagement: React.FC<FinanceiroManagementProps> = ({ initialSubTab = 'extrato' }) => {
  const [subTab, setSubTab] = useState<FinanceiroSubTab>(initialSubTab);

  const renderSubContent = () => {
    switch (subTab) {
      case 'pdv':
        return <PdvInteligente />;
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
      <AdminTabs tabs={subTabs} activeId={subTab} onChange={(id) => setSubTab(id as FinanceiroSubTab)} />

      <AdminModuleNotice
        title="Financeiro operacional enxuto"
        description="PDV e Extrato são as áreas ativas porque já gravam e consultam lançamentos reais no banco."
        detail="Caixa de sessão, contas a pagar, saúde e relatórios avançados ficam bloqueados até existir uma modelagem persistida, evitando números demonstrativos no painel."
      />

      <div className="animate-fade-in min-w-0">
        {renderSubContent()}
      </div>
    </div>
  );
};
