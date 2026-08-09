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
 * - No desktop (md+): 1 card, 1 linha, ícone + título + estatísticas
 *   curtas (StatPill) à esquerda, botão dourado à direita.
 */

export interface AdminStat {
  /** Rótulo curto, ex: "itens", "combos", "abertas" */
  label: string;
  value: string | number;
  /** Cor de destaque do valor. Default = dourado. */
  tone?: 'gold' | 'success' | 'info' | 'warning' | 'muted';
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
    <div className="hidden md:flex items-center justify-between gap-4 bg-surface-card px-4 py-3.5 rounded-2xl border border-border-subtle">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gold-base/10 text-gold-base flex items-center justify-center border border-gold-base/20 shrink-0">
          <Icon className="w-4 h-4" />
        </div>

        <h1 className="text-base font-medium text-content-base tracking-tight truncate">
          {title}
        </h1>

        {stats.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-content-muted whitespace-nowrap pl-1 border-l border-border-subtle ml-1">
            {stats.map((stat, idx) => (
              <React.Fragment key={stat.label}>
                {idx > 0 && <span className="text-border-subtle">·</span>}
                <span>
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
            className="px-4 py-2 rounded-xl bg-gold-base text-surface-base font-bold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <ActionIcon className="w-3.5 h-3.5 stroke-[3]" />
            <span>{action.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminPageHeader;
