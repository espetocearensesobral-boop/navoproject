import React from "react";
import { LucideIcon, Plus } from "lucide-react";

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
  tone?:
    | "gold"
    | "success"
    | "info"
    | "warning"
    | "muted"
    | "finance-positive"
    | "finance-negative";
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

const TONE_CLASSES: Record<NonNullable<AdminStat["tone"]>, string> = {
  gold: "text-[var(--admin-accent)]",
  success: "text-status-success",
  info: "text-blue-400",
  warning: "text-amber-400",
  muted: "text-[var(--admin-text-muted)]",
  "finance-positive": "finance-positive",
  "finance-negative": "finance-negative",
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
    <div className="hidden md:flex min-h-[48px] items-center justify-between gap-4 border-b border-[var(--admin-border)] pb-4 overflow-hidden">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-[var(--admin-radius-sm)] bg-[var(--admin-surface)] text-[var(--admin-accent)] flex items-center justify-center border border-[var(--admin-border)] shrink-0">
          <Icon className="w-4 h-4" />
        </div>

        <h1 className="admin-title-h2 text-[var(--admin-text-main)] truncate min-w-0 shrink">
          {title}
        </h1>

        {stats.length > 0 && (
          <div className="flex items-center gap-2 text-[var(--text-body-sm)] text-[var(--admin-text-muted)] whitespace-nowrap pl-4 border-l border-[var(--admin-border)] ml-2 shrink-0 overflow-x-auto no-scrollbar max-w-[45vw]">
            {stats.map((stat, idx) => (
              <React.Fragment key={stat.label}>
                {idx > 0 && (
                  <span className="text-[var(--admin-border)]">·</span>
                )}
                <span className="admin-label">
                  <span
                    className={`font-semibold ${TONE_CLASSES[stat.tone ?? "gold"]}`}
                  >
                    {stat.value}
                  </span>{" "}
                  <span className="text-[var(--admin-text-muted)] font-medium normal-case tracking-normal">
                    {stat.label}
                  </span>
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
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className="admin-btn admin-btn-sm admin-btn-primary shrink-0 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
          >
            <ActionIcon className="w-4 h-4 shrink-0" />
            <span className="admin-button-label whitespace-nowrap">{action.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminPageHeader;
