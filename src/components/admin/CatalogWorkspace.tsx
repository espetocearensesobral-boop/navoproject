import React, { useEffect, useState } from "react";
import { ChevronDown, Package, Scissors, Users } from "lucide-react";
import { ServicesManagement } from "./ServicesManagement";
import { ProfessionalsManagement } from "./ProfessionalsManagement";
import { ProductsManagement } from "./ProductsManagement";
import { AdminPageHeader } from "./shared/AdminPageHeader";

export type CatalogSectionId = "services" | "professionals" | "products";

type CatalogSection = {
  id: CatalogSectionId;
  label: string;
  summary: string;
  icon: React.ElementType;
  component: React.ComponentType;
};

const sections: CatalogSection[] = [
  {
    id: "services",
    label: "Serviços",
    summary: "Preços, duração, categorias e regras dos atendimentos",
    icon: Scissors,
    component: ServicesManagement,
  },
  {
    id: "professionals",
    label: "Profissionais",
    summary: "Equipe, especialidades, comissões e agenda individual",
    icon: Users,
    component: ProfessionalsManagement,
  },
  {
    id: "products",
    label: "Produtos e estoque",
    summary: "Cadastro, preços, quantidade e controle de estoque",
    icon: Package,
    component: ProductsManagement,
  },
];

export const CatalogWorkspace: React.FC<{ initialTab?: CatalogSectionId }> = ({
  initialTab = "services",
}) => {
  const [openSections, setOpenSections] = useState<Record<CatalogSectionId, boolean>>({
    services: initialTab === "services",
    professionals: initialTab === "professionals",
    products: initialTab === "products",
  });

  useEffect(() => {
    if (initialTab) {
      setOpenSections((prev) => ({
        ...prev,
        [initialTab]: true,
      }));
    }
  }, [initialTab]);

  const toggleSection = (id: CatalogSectionId) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const openCount = Object.values(openSections).filter(Boolean).length;

  return (
    <div className="admin-catalog-workspace min-w-0 space-y-4">
      <AdminPageHeader
        icon={Package}
        title="Catálogo"
        stats={[{ label: "seções", value: `${openCount} de 3 ativas` }]}
      />

      <div className="space-y-3" aria-label="Seções do catálogo">
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
                id={`catalog-section-btn-${section.id}`}
                aria-controls={`catalog-section-content-${section.id}`}
                aria-expanded={isOpen}
                onClick={() => toggleSection(section.id)}
                className="flex min-h-[74px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-bg)] sm:px-5"
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
                  id={`catalog-section-content-${section.id}`}
                  role="region"
                  aria-labelledby={`catalog-section-btn-${section.id}`}
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

