import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Padrão único de abas (navegação secundária) para todas as telas do /admin.
 *
 * Antes desta unificação, cada tela reimplementava sua própria lista de
 * botões de aba com estilos visuais diferentes (algumas em "pílula" dourada,
 * outras com sublinhado, outras com cantos arredondados só em cima) e a
 * mesma string de className duplicada em cada `<button>`. Isso fazia o app
 * parecer inconsistente ao navegar entre módulos e multiplicava o trabalho
 * de manutenção. Agora existe um único componente: qualquer tela com abas
 * (Financeiro, Comandas, Assinaturas, Relatórios, Perfil da
 * Barbearia, Configurações, etc.) usa <AdminTabs /> e herda o mesmo visual,
 * o mesmo comportamento de rolagem horizontal no mobile e o mesmo contrato
 * de props.
 */

export interface AdminTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Contador opcional (ex: nº de comandas abertas) exibido como badge. */
  count?: number;
  disabled?: boolean;
}

interface AdminTabsProps {
  tabs: AdminTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Classes extras opcionais (ex: espaçamento específico da tela). */
  className?: string;
}

export const AdminTabs: React.FC<AdminTabsProps> = ({ tabs, activeId, onChange, className = '' }) => {
  return (
    <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1 ${className}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            aria-disabled={tab.disabled || undefined}
            className={`shrink-0 min-h-11 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors active:scale-95 ${
              tab.disabled
                ? 'bg-surface-base/60 text-content-muted/50 border border-border-subtle/60 cursor-not-allowed'
                : isActive
                  ? 'bg-gold-base text-surface-base shadow-sm'
                  : 'bg-surface-card text-content-muted border border-border-subtle hover:text-content-base'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span className="whitespace-nowrap">{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`min-w-6 h-6 px-1 rounded-full text-xs flex items-center justify-center font-extrabold shrink-0 ${
                  isActive ? 'bg-surface-base/25 text-surface-base' : 'bg-gold-base/10 text-gold-base'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default AdminTabs;
