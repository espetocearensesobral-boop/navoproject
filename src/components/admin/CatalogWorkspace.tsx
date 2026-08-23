import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Package, Scissors, Users } from "lucide-react";
import { ServicesManagement } from "./ServicesManagement";
import { ProfessionalsManagement } from "./ProfessionalsManagement";
import { ProductsManagement } from "./ProductsManagement";
import { AdminPageHeader } from "./shared/AdminPageHeader";

type CatalogTab = "services" | "professionals" | "products";
type CatalogGroupId = "service-catalog" | "product-catalog";

type CatalogOption = {
  id: CatalogTab;
  label: string;
  description: string;
  icon: React.ElementType;
};
type CatalogGroup = {
  id: CatalogGroupId;
  label: string;
  summary: string;
  icon: React.ElementType;
  options: CatalogOption[];
};

const groups: CatalogGroup[] = [
  {
    id: "service-catalog",
    label: "Catálogo de atendimento",
    summary: "Serviços, profissionais e disponibilidade para agendamento",
    icon: Scissors,
    options: [
      {
        id: "services",
        label: "Serviços",
        description: "Preços, duração e regras dos atendimentos",
        icon: Scissors,
      },
      {
        id: "professionals",
        label: "Profissionais",
        description: "Equipe, especialidades e agenda individual",
        icon: Users,
      },
    ],
  },
  {
    id: "product-catalog",
    label: "Produtos e estoque",
    summary: "Itens comercializados e controle de estoque",
    icon: Package,
    options: [
      {
        id: "products",
        label: "Produtos e estoque",
        description: "Cadastro, preços, quantidade e movimentações",
        icon: Package,
      },
    ],
  },
];

const groupForTab = (tab: CatalogTab): CatalogGroupId =>
  groups.find((group) => group.options.some((option) => option.id === tab))
    ?.id || "service-catalog";

export const CatalogWorkspace: React.FC<{ initialTab?: CatalogTab }> = ({
  initialTab = "services",
}) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>(initialTab);
  const [openGroup, setOpenGroup] = useState<CatalogGroupId | null>(() =>
    initialTab === "services" ? null : groupForTab(initialTab as CatalogTab),
  );

  useEffect(() => {
    setActiveTab(initialTab);
    setOpenGroup(
      initialTab === "services" ? null : groupForTab(initialTab as CatalogTab),
    );
  }, [initialTab]);

  const activeOption = useMemo(
    () =>
      groups
        .flatMap((group) => group.options)
        .find((option) => option.id === activeTab),
    [activeTab],
  );

  const selectOption = (groupId: CatalogGroupId, tab: CatalogTab) => {
    setOpenGroup(groupId);
    setActiveTab(tab);
  };

  const renderContent = () => {
    if (activeTab === "services") return <ServicesManagement />;
    if (activeTab === "professionals") return <ProfessionalsManagement />;
    return <ProductsManagement />;
  };

  return (
    <div className="admin-catalog-workspace min-w-0 space-y-4">
      <AdminPageHeader
        icon={Package}
        title="Catálogo"
        stats={[{ label: "seção", value: activeOption?.label || "Serviços" }]}
      />

      <div className="space-y-3" aria-label="Seções do catálogo">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroup === group.id;
          return (
            <section
              key={group.id}
              className={`overflow-hidden rounded-xl border bg-[var(--admin-surface)] transition-colors ${isOpen ? "border-[var(--admin-accent)]/40" : "border-[var(--admin-border)]"}`}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenGroup((current) =>
                    current === group.id ? null : group.id,
                  )
                }
                aria-expanded={isOpen}
                className="flex min-h-[74px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-bg)] sm:px-5"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOpen ? "bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]" : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)]"}`}
                >
                  <GroupIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[var(--admin-text-main)] sm:text-[15px]">
                    {group.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--admin-text-muted)]">
                    {group.summary}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--admin-text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180 text-[var(--admin-accent)]" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-[var(--admin-border)] px-3 pb-4 pt-3 sm:px-4 sm:pb-5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.options.map((option) => {
                      const OptionIcon = option.icon;
                      const isActive = activeTab === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => selectOption(group.id, option.id)}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex min-h-[64px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${isActive ? "border-[var(--admin-accent)]/40 bg-[var(--admin-accent)]/10" : "border-[var(--admin-border)] bg-[var(--admin-bg)] hover:border-border-strong hover:bg-[var(--admin-surface)]"}`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]" : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)]"}`}
                          >
                            <OptionIcon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span
                              className={`block truncate text-xs font-bold ${isActive ? "text-[var(--admin-accent)]" : "text-[var(--admin-text-main)]"}`}
                            >
                              {option.label}
                            </span>
                            <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-[var(--admin-text-muted)]">
                              {option.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 border-t border-[var(--admin-border)] pt-4">
                    {renderContent()}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
