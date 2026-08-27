import React, { useEffect, useRef, useState } from "react";
import {
  Award,
  Cake,
  ChevronDown,
  Gift,
  History,
  LayoutDashboard,
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

export type RelationshipSectionId =
  | "overview"
  | "reviews"
  | "followup"
  | "loyalty"
  | "rewards"
  | "referrals"
  | "reminders"
  | "birthdays";

type RelationshipSectionItem = {
  id: RelationshipSectionId;
  label: string;
  category: string;
  description: string;
  icon: React.ElementType;
};

const relationshipSections: RelationshipSectionItem[] = [
  {
    id: "overview",
    label: "Visão geral",
    category: "Métricas",
    description: "Indicadores de relacionamento, métricas de retenção e visão consolidada",
    icon: LayoutDashboard,
  },
  {
    id: "reviews",
    label: "Avaliações e feedbacks",
    category: "Satisfação",
    description: "NPS, notas dos clientes e tratamento de feedbacks de atendimento",
    icon: Star,
  },
  {
    id: "followup",
    label: "Follow-up pós-atendimento",
    category: "Retenção",
    description: "Acompanhamento automático e mensagens de pós-venda para clientes",
    icon: History,
  },
  {
    id: "loyalty",
    label: "Programa de fidelidade",
    category: "Fidelização",
    description: "Regras de pontuação, níveis de membros (tiers), saldos e histórico de pontos",
    icon: Award,
  },
  {
    id: "rewards",
    label: "Catálogo de prêmios",
    category: "Benefícios",
    description: "Criação de cupons, recompensas resgatáveis e controle de vouchers",
    icon: Gift,
  },
  {
    id: "referrals",
    label: "Programa de indicações",
    category: "Crescimento",
    description: "Links exclusivos de indicação, bônus de novos clientes e motor de crescimento",
    icon: UserRound,
  },
  {
    id: "reminders",
    label: "Lembretes WhatsApp",
    category: "Comunicação",
    description: "Régua de comunicação pré-agendamento, confirmações e avisos automáticos",
    icon: Zap,
  },
  {
    id: "birthdays",
    label: "Aniversariantes",
    category: "Celebração",
    description: "Lista de clientes aniversariantes do mês e mensagens personalizadas de parabéns",
    icon: Cake,
  },
];

export const RelationshipWorkspace: React.FC<{
  initialTab?: RelationshipSectionId;
}> = ({ initialTab = "overview" }) => {
  const [openSection, setOpenSection] = useState<RelationshipSectionId | null>(
    initialTab,
  );
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (initialTab) {
      setOpenSection(initialTab);
    }
  }, [initialTab]);

  const toggleSection = (id: RelationshipSectionId) => {
    setOpenSection((current) => {
      const next = current === id ? null : id;
      if (next && sectionRefs.current[next]) {
        setTimeout(() => {
          sectionRefs.current[next]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 100);
      }
      return next;
    });
  };

  const renderSectionContent = (id: RelationshipSectionId) => {
    switch (id) {
      case "overview":
        return <NavoRewardsAdmin initialTab="dashboard" />;
      case "reviews":
        return <NavoRewardsAdmin initialTab="reviews" />;
      case "followup":
        return <FollowUpManagement />;
      case "loyalty":
        return <NavoRewardsAdmin initialTab="loyalty" />;
      case "rewards":
        return <NavoRewardsAdmin initialTab="rewards" />;
      case "referrals":
        return <NavoRewardsAdmin initialTab="referrals" />;
      case "reminders":
        return <AppointmentRemindersManagement />;
      case "birthdays":
        return <BirthdaysManagement />;
      default:
        return null;
    }
  };

  const activeSectionInfo = relationshipSections.find(
    (sec) => sec.id === openSection,
  );

  return (
    <div className="admin-relationship-workspace min-w-0 space-y-4">
      <AdminPageHeader
        icon={Users}
        title="Relacionamento"
        stats={[
          {
            label: "seção ativa",
            value: activeSectionInfo ? activeSectionInfo.label : "Nenhuma",
          },
          {
            label: "total de módulos",
            value: relationshipSections.length,
          },
        ]}
      />

      <div className="space-y-3" aria-label="Módulos de relacionamento">
        {relationshipSections.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = openSection === section.id;

          return (
            <section
              key={section.id}
              ref={(el) => {
                sectionRefs.current[section.id] = el;
              }}
              tabIndex={-1}
              className={`scroll-mt-4 sm:scroll-mt-6 overflow-hidden rounded-[var(--admin-radius-lg)] border bg-[var(--admin-surface)] transition-all duration-200 focus:outline-none ${
                isOpen
                  ? "border-[var(--admin-accent)]/40 ring-1 ring-[var(--admin-accent)]/20 shadow-xs"
                  : "border-[var(--admin-border)] hover:border-[var(--admin-border-subtle)] hover:bg-[var(--admin-surface-hover)]"
              }`}
            >
              {/* Cabeçalho do Menu Recolhível Individual */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
                className="flex min-h-[64px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-surface-hover)] sm:px-5 cursor-pointer"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-md)] transition-colors ${
                    isOpen
                      ? "bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]"
                      : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)]"
                  }`}
                >
                  <SectionIcon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--admin-text-main)]">
                      {section.label}
                    </span>
                    <span className="inline-flex items-center rounded-[var(--admin-radius-full)] bg-[var(--admin-bg)] border border-[var(--admin-border)] px-2 py-0.5 text-[9px] font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider">
                      {section.category}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--admin-text-muted)]">
                    {section.description}
                  </span>
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-flex text-[11px] font-medium text-[var(--admin-text-muted)]">
                    {isOpen ? "Recolher" : "Expandir"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--admin-text-muted)] transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-[var(--admin-accent)]" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Conteúdo Renderizado quando o Menu está Expandido */}
              {isOpen && (
                <div className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)]/40 p-4 sm:p-5 animate-in fade-in duration-200">
                  {renderSectionContent(section.id)}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

