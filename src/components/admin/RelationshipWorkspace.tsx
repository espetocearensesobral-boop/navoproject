import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  Cake,
  ChevronDown,
  ChevronUp,
  Gift,
  History,
  LayoutDashboard,
  MessageSquare,
  SlidersHorizontal,
  Star,
  Users,
  UserRound,
  Zap,
} from "lucide-react";
import { NavoRewardsAdmin } from "./NavoRewardsAdmin";
import { FollowUpManagement } from "./FollowUpManagement";
import { BirthdaysManagement } from "./BirthdaysManagement";
import { AppointmentRemindersManagement } from "./AppointmentRemindersManagement";
import { AdminPageHeader } from "./shared/AdminPageHeader";

type RelationshipTab =
  | "overview"
  | "loyalty"
  | "reviews"
  | "followup"
  | "birthdays"
  | "reminders"
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
    summary: "Lembretes, aniversários e contatos de relacionamento",
    icon: Cake,
    options: [
      {
        id: "reminders",
        label: "Lembretes WhatsApp",
        description: "Lembretes 2h antes, confirmações e avisos",
        icon: Zap,
      },
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
  const [expandedOptions, setExpandedOptions] = useState<
    Record<RelationshipGroupId, boolean>
  >({
    relationship: true,
    retention: true,
    care: true,
  });
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setActiveTab(initialTab);
    setOpenGroup(
      initialTab === "overview"
        ? null
        : groupForTab(initialTab as RelationshipTab),
    );
  }, [initialTab]);

  useEffect(() => {
    if (openGroup && sectionRefs.current[openGroup]) {
      const el = sectionRefs.current[openGroup];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.focus({ preventScroll: true });
      }
    }
  }, [openGroup]);

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

  const toggleOptionsCollapse = (groupId: RelationshipGroupId) => {
    setExpandedOptions((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const renderContent = () => {
    if (activeTab === "reminders") return <AppointmentRemindersManagement />;
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
          const isOptionsExpanded = expandedOptions[group.id] ?? true;
          const groupActiveOption = group.options.find(
            (opt) => opt.id === activeTab,
          );

          return (
            <section
              key={group.id}
              ref={(el) => {
                sectionRefs.current[group.id] = el;
              }}
              tabIndex={-1}
              className={`scroll-mt-4 sm:scroll-mt-6 overflow-hidden rounded-xl border bg-[var(--admin-surface)] transition-colors focus:outline-none ${isOpen ? "border-[var(--admin-accent)]/40 shadow-xs ring-1 ring-[var(--admin-accent)]/20" : "border-[var(--admin-border)]"}`}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenGroup((current) =>
                    current === group.id ? null : group.id,
                  )
                }
                aria-expanded={isOpen}
                className="flex min-h-[74px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-bg)] sm:px-5 cursor-pointer"
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
                  {/* Collapsible Options Header / Sub-menu bar */}
                  <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-[var(--admin-bg)]/80 px-3 py-2 border border-[var(--admin-border)]">
                    <div className="flex items-center gap-2 min-w-0">
                      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--admin-accent)]" />
                      <span className="text-xs font-semibold text-[var(--admin-text-main)] truncate">
                        Opções de navegação
                      </span>
                      {groupActiveOption && (
                        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[var(--admin-accent)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--admin-accent)]">
                          Ativo: {groupActiveOption.label}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleOptionsCollapse(group.id)}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)] transition-colors cursor-pointer"
                      aria-expanded={isOptionsExpanded}
                    >
                      <span>{isOptionsExpanded ? "Recolher opções" : "Expandir opções"}</span>
                      {isOptionsExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Collapsible Options Grid */}
                  {isOptionsExpanded ? (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 animate-in fade-in duration-200">
                      {group.options.map((option) => {
                        const OptionIcon = option.icon;
                        const isActive = activeTab === option.id;
                        return (
                          <button
                            key={`${group.id}-${option.id}`}
                            type="button"
                            onClick={() => selectOption(group.id, option.id)}
                            aria-current={isActive ? "page" : undefined}
                            className={`flex min-h-[64px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${isActive ? "border-[var(--admin-accent)]/40 bg-[var(--admin-accent)]/10" : "border-[var(--admin-border)] bg-[var(--admin-bg)] hover:border-border-strong hover:bg-[var(--admin-surface)]"}`}
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
                  ) : (
                    /* Compact view when options are collapsed */
                    <div className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {groupActiveOption ? (
                          <>
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]">
                              <groupActiveOption.icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="font-semibold text-[var(--admin-text-main)] truncate">
                              {groupActiveOption.label}
                            </span>
                            <span className="hidden sm:inline text-[11px] text-[var(--admin-text-muted)] truncate">
                              — {groupActiveOption.description}
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--admin-text-muted)]">
                            Selecione uma opção acima para visualizar
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleOptionsCollapse(group.id)}
                        className="text-[11px] font-semibold text-[var(--admin-accent)] hover:underline ml-2 shrink-0 cursor-pointer"
                      >
                        Alternar opção
                      </button>
                    </div>
                  )}

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
