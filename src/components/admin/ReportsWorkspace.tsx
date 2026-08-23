import React, { useEffect, useState } from "react";
import {
  Activity,
  ChevronDown,
  FileText,
  TrendingUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { OperationalReportsManagement } from "./OperationalReportsManagement";
import { ReportsManagement } from "./ReportsManagement";
import { AdminPageHeader } from "./shared/AdminPageHeader";

export type ReportsSectionId = "operational" | "financial";

type ReportsSection = {
  id: ReportsSectionId;
  label: string;
  summary: string;
  icon: React.ElementType;
  component: React.ComponentType;
};

const sections: ReportsSection[] = [
  {
    id: "operational",
    label: "Operações",
    summary: "Agendamentos, ocupação, fila em tempo real e performance da equipe",
    icon: Activity,
    component: OperationalReportsManagement,
  },
  {
    id: "financial",
    label: "Financeiro",
    summary: "Faturamento, fluxo de caixa diário, serviços prestados e despesas",
    icon: TrendingUp,
    component: ReportsManagement,
  },
];

export const ReportsWorkspace: React.FC<{ initialTab?: ReportsSectionId }> = ({
  initialTab = "operational",
}) => {
  const [openSections, setOpenSections] = useState<Record<ReportsSectionId, boolean>>({
    operational: initialTab === "operational",
    financial: initialTab === "financial",
  });

  useEffect(() => {
    if (initialTab) {
      setOpenSections((prev) => ({
        ...prev,
        [initialTab]: true,
      }));
    }
  }, [initialTab]);

  const toggleSection = (id: ReportsSectionId) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    setOpenSections({
      operational: true,
      financial: true,
    });
  };

  const collapseAll = () => {
    setOpenSections({
      operational: false,
      financial: false,
    });
  };

  const openCount = Object.values(openSections).filter(Boolean).length;

  return (
    <div className="admin-reports-workspace min-w-0 space-y-4">
      <AdminPageHeader
        icon={FileText}
        title="Relatórios"
        stats={[{ label: "módulos", value: `${openCount} de 2 abertos` }]}
      >
        <div className="flex items-center gap-2">
          {openCount < 2 ? (
            <button
              type="button"
              onClick={expandAll}
              className="admin-btn admin-btn-sm admin-btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
              title="Expandir todos os relatórios"
              aria-label="Expandir todos os relatórios"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Expandir todos</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={collapseAll}
              className="admin-btn admin-btn-sm admin-btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
              title="Recolher todos os relatórios"
              aria-label="Recolher todos os relatórios"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Recolher todos</span>
            </button>
          )}
        </div>
      </AdminPageHeader>

      <div className="space-y-3" aria-label="Seções de relatórios">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          const Component = section.component;
          const isOpen = Boolean(openSections[section.id]);

          return (
            <section
              key={section.id}
              className={`overflow-hidden rounded-xl border bg-[var(--admin-surface)] transition-colors ${
                isOpen
                  ? "border-[var(--admin-accent)]/40 shadow-xs"
                  : "border-[var(--admin-border)]"
              }`}
            >
              <button
                type="button"
                id={`reports-section-btn-${section.id}`}
                aria-controls={`reports-section-content-${section.id}`}
                aria-expanded={isOpen}
                onClick={() => toggleSection(section.id)}
                className="flex min-h-[74px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-bg)] sm:px-5 cursor-pointer"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    isOpen
                      ? "bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]"
                      : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)]"
                  }`}
                >
                  <SectionIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[var(--admin-text-main)] sm:text-[15px]">
                    {section.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--admin-text-muted)]">
                    {section.summary}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--admin-text-muted)] transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-[var(--admin-accent)]" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div
                  id={`reports-section-content-${section.id}`}
                  role="region"
                  aria-labelledby={`reports-section-btn-${section.id}`}
                  className="border-t border-[var(--admin-border)] px-3 pb-4 pt-4 sm:px-4 sm:pb-5"
                >
                  <Component />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
