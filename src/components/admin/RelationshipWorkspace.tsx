import React, { useEffect, useMemo, useState } from "react";
import {
  Award,
  Cake,
  ChevronDown,
  Gift,
  History,
  LayoutDashboard,
  MessageSquare,
  Star,
  Users,
  UserRound,
} from "lucide-react";
import { NavoRewardsAdmin } from "./NavoRewardsAdmin";
import { FollowUpManagement } from "./FollowUpManagement";
import { BirthdaysManagement } from "./BirthdaysManagement";
import { AdminPageHeader } from "./shared/AdminPageHeader";

type RelationshipTab =
  | "overview"
  | "loyalty"
  | "reviews"
  | "followup"
  | "birthdays"
  | "referrals"
  | "rewards";
type RelationshipGroupId = "relationship" | "retention" | "care";

type RelationshipOption = {
  id: RelationshipTab;
  label: string;
  description: string;
  icon: React.ElementType;
};
type RelationshipGroup = {
  id: RelationshipGroupId;
  label: string;
  summary: string;
  icon: React.ElementType;
  options: RelationshipOption[];
};

const groups: RelationshipGroup[] = [
  {
    id: "relationship",
    label: "Relacionamento com clientes",
    summary: "Visão geral, avaliações e acompanhamento da base",
    icon: Users,
    options: [
      {
        id: "overview",
        label: "Visão geral",
        description: "Indicadores de relacionamento e NPS",
        icon: LayoutDashboard,
      },
      {
        id: "reviews",
        label: "Avaliações",
        description: "Avaliações, NPS e tratamento de feedbacks",
        icon: Star,
      },
      {
        id: "followup",
        label: "Follow-up",
        description: "Acompanhe clientes após os atendimentos",
        icon: History,
      },
    ],
  },
  {
    id: "retention",
    label: "Fidelização e benefícios",
    summary: "Clube, níveis, prêmios e indicações",
    icon: Award,
    options: [
      {
        id: "loyalty",
        label: "Fidelidade",
        description: "Pontos, níveis e regras do clube",
        icon: Award,
      },
      {
        id: "rewards",
        label: "Prêmios",
        description: "Benefícios, cupons e catálogo de recompensas",
        icon: Gift,
      },
      {
        id: "referrals",
        label: "Indicações",
        description: "Links, bônus e motor de indicação",
        icon: UserRound,
      },
    ],
  },
  {
    id: "care",
    label: "Cuidado e recorrência",
    summary: "Aniversários e contatos de relacionamento",
    icon: Cake,
    options: [
      {
        id: "birthdays",
        label: "Aniversários",
        description: "Clientes aniversariantes e mensagens",
        icon: Cake,
      },
    ],
  },
];

const groupForTab = (tab: RelationshipTab): RelationshipGroupId =>
  groups.find((group) => group.options.some((option) => option.id === tab))
    ?.id || "relationship";

export const RelationshipWorkspace: React.FC<{
  initialTab?: RelationshipTab;
}> = ({ initialTab = "overview" }) => {
  const [activeTab, setActiveTab] = useState<RelationshipTab>(initialTab);
  const [openGroup, setOpenGroup] = useState<RelationshipGroupId | null>(() =>
    initialTab === "overview"
      ? null
      : groupForTab(initialTab as RelationshipTab),
  );

  useEffect(() => {
    setActiveTab(initialTab);
    setOpenGroup(
      initialTab === "overview"
        ? null
        : groupForTab(initialTab as RelationshipTab),
    );
  }, [initialTab]);

  const activeOption = useMemo(
    () =>
      groups
        .flatMap((group) => group.options)
        .find((option) => option.id === activeTab),
    [activeTab],
  );

  const selectOption = (groupId: RelationshipGroupId, tab: RelationshipTab) => {
    setOpenGroup(groupId);
    setActiveTab(tab);
  };

  const renderContent = () => {
    if (activeTab === "followup") return <FollowUpManagement />;
    if (activeTab === "birthdays") return <BirthdaysManagement />;
    return (
      <NavoRewardsAdmin
        initialTab={activeTab === "overview" ? "dashboard" : activeTab}
      />
    );
  };

  return (
    <div className="admin-relationship-workspace min-w-0 space-y-4">
      <AdminPageHeader
        icon={Users}
        title="Relacionamento"
        stats={[
          { label: "seção", value: activeOption?.label || "Visão geral" },
        ]}
      />

      <div className="space-y-3" aria-label="Seções de relacionamento">
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
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {group.options.map((option) => {
                      const OptionIcon = option.icon;
                      const isActive = activeTab === option.id;
                      return (
                        <button
                          key={`${group.id}-${option.id}`}
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
