import React from 'react';
import { LucideIcon, Plus } from 'lucide-react';

/**
 * Padrão único de cabeçalho para todas as telas do /admin.
 *
 * Regra: título + contexto numérico + 1 botão primário. Nada além disso.
 * - No mobile este componente não renderiza nada: o nome do módulo já
 *   aparece na topbar fixa do AdminLayout, então repetir o título aqui
 *   só ocupa espaço. Cada tela mantém sua própria barra de ação mobile
 *   (busca + botão) que já é compacta.
 * - No desktop (md+): 1 barra discreta, 1 linha, ícone + título + estatísticas
 *   curtas à esquerda, botão primário à direita.
 */

export interface AdminStat {
  /** Rótulo curto, ex: "itens", "combos", "abertas" */
  label: string;
  value: string | number;
  /** Cor de destaque do valor. Default = dourado. */
  tone?: 'gold' | 'success' | 'info' | 'warning' | 'muted' | 'finance-positive' | 'finance-negative';
}

export interface AdminPageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
}

interface AdminPageHeaderProps {
  icon: LucideIcon;
  title: string;
  stats?: AdminStat[];
  action?: AdminPageHeaderAction;
  /** Controles extras opcionais (ex: seletor de data na Agenda) */
  children?: React.ReactNode;
}

const TONE_CLASSES: Record<NonNullable<AdminStat['tone']>, string> = {
  gold: 'text-gold-base',
  success: 'text-status-success',
  info: 'text-blue-400',
  warning: 'text-amber-400',
  muted: 'text-content-muted',
  'finance-positive': 'finance-positive',
  'finance-negative': 'finance-negative',
};

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  icon: Icon,
  title,
  stats = [],
  action,
  children,
}) => {
  const ActionIcon = action?.icon ?? Plus;

  return (
    <div className="hidden md:flex min-h-12 items-center justify-between gap-4 border-b border-border-subtle pb-3 overflow-hidden">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="w-7 h-7 rounded-md bg-surface-card text-gold-base flex items-center justify-center border border-border-subtle shrink-0">
          <Icon className="w-4 h-4" />
        </div>

        <h1 className="admin-copy-title text-sm font-semibold text-content-base tracking-tight truncate min-w-0 shrink">
          {title}
        </h1>

        {stats.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-content-muted whitespace-nowrap pl-3 border-l border-border-subtle ml-2 shrink-0 overflow-x-auto no-scrollbar max-w-[45vw]">
            {stats.map((stat, idx) => (
              <React.Fragment key={stat.label}>
                {idx > 0 && <span className="text-border-subtle">·</span>}
                <span className="admin-copy-label">
                  <span className={`font-semibold ${TONE_CLASSES[stat.tone ?? 'gold']}`}>
                    {stat.value}
                  </span>{' '}
                  {stat.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
        {action && (
          <button
            onClick={action.onClick}
            disabled={action.disabled}
            className="min-h-9 min-w-0 px-3 py-1.5 rounded-md bg-gold-base text-content-on-accent font-bold text-xs flex items-center gap-1.5 hover:bg-gold-hover active:scale-95 transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap shrink-0"
          >
            <ActionIcon className="w-4 h-4 stroke-[3] shrink-0" />
            <span className="admin-button-label">{action.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminPageHeader;
