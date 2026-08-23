import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Globe2,
  Mail,
  Megaphone,
  MessageSquare,
  Printer,
  QrCode,
  Settings,
  ShieldCheck,
  Store,
  Target,
} from "lucide-react";
import { BarbershopProfileManagement } from "./BarbershopProfileManagement";
import { SettingsManagement, type SettingsTab } from "./SettingsManagement";
import { AdminPageHeader } from "./shared/AdminPageHeader";

type SystemTab =
  | "unit"
  | "preferences"
  | "availability"
  | "notifications"
  | "qrcode"
  | "print"
  | "audit"
  | "meta_ads"
  | "google_ads";
type SystemGroupId = "operation" | "communication" | "marketing" | "security";

type SystemOption = {
  id: SystemTab;
  label: string;
  description: string;
  icon: React.ElementType;
};
type SystemGroup = {
  id: SystemGroupId;
  label: string;
  summary: string;
  icon: React.ElementType;
  options: SystemOption[];
};

const groups: SystemGroup[] = [
  {
    id: "operation",
    label: "Operação da unidade",
    summary: "Perfil, agenda, preferências e impressões",
    icon: Store,
    options: [
      {
        id: "unit",
        label: "Unidade",
        description: "Nome, endereço e identidade da operação",
        icon: Store,
      },
      {
        id: "preferences",
        label: "Preferências",
        description: "E-mail, avisos e preferências gerais",
        icon: Settings,
      },
      {
        id: "availability",
        label: "Agenda",
        description: "Disponibilidade e regras de atendimento",
        icon: CalendarDays,
      },
      {
        id: "print",
        label: "Impressões",
        description: "Comprovantes, relatórios e QR Code",
        icon: Printer,
      },
    ],
  },
  {
    id: "communication",
    label: "Comunicação e canais",
    summary: "WhatsApp, notificações, e-mail e QR Code",
    icon: MessageSquare,
    options: [
      {
        id: "notifications",
        label: "Notificações",
        description: "E-mail e mensagens de atendimento",
        icon: Mail,
      },
      {
        id: "qrcode",
        label: "QR Code",
        description: "Conexão e acesso rápido ao WhatsApp",
        icon: QrCode,
      },
    ],
  },
  {
    id: "marketing",
    label: "Marketing e integrações",
    summary: "Meta Ads e Google Ads",
    icon: Megaphone,
    options: [
      {
        id: "meta_ads",
        label: "Meta Ads",
        description: "Facebook, Instagram e campanhas Meta",
        icon: Target,
      },
      {
        id: "google_ads",
        label: "Google Ads",
        description: "Campanhas, métricas e conta Google",
        icon: Globe2,
      },
    ],
  },
  {
    id: "security",
    label: "Segurança e auditoria",
    summary: "Registros e acompanhamento de alterações",
    icon: ShieldCheck,
    options: [
      {
        id: "audit",
        label: "Auditoria",
        description: "Histórico de ações administrativas",
        icon: ShieldCheck,
      },
    ],
  },
];

const groupForTab = (tab: SystemTab): SystemGroupId =>
  groups.find((group) => group.options.some((option) => option.id === tab))
    ?.id || "operation";

export const SystemWorkspace: React.FC<{
  initialTab?: SystemTab;
  onOpenCampaigns?: (provider?: "meta" | "google") => void;
}> = ({ initialTab = "unit", onOpenCampaigns }) => {
  const [activeTab, setActiveTab] = useState<SystemTab>(initialTab);
  const [openGroup, setOpenGroup] = useState<SystemGroupId | null>(() =>
    initialTab === "unit" ? null : groupForTab(initialTab as SystemTab),
  );
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setActiveTab(initialTab);
    setOpenGroup(
      initialTab === "unit" ? null : groupForTab(initialTab as SystemTab),
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

  const selectOption = (groupId: SystemGroupId, tab: SystemTab) => {
    setOpenGroup(groupId);
    setActiveTab(tab);
  };

  const renderContent = () => {
    if (activeTab === "unit") return <BarbershopProfileManagement />;
    const settingsTab: SettingsTab =
      activeTab === "preferences"
        ? "email"
        : activeTab === "notifications"
          ? "whatsapp"
          : activeTab;
    return (
      <SettingsManagement
        initialTab={settingsTab}
        hideTabs
        onOpenCampaigns={onOpenCampaigns}
      />
    );
  };

  return (
    <div className="admin-system-workspace min-w-0 space-y-4">
      <AdminPageHeader
        icon={Settings}
        title="Configurações do Sistema"
        stats={[{ label: "seção", value: activeOption?.label || "Unidade" }]}
      />

      <div className="space-y-3" aria-label="Seções de configurações">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroup === group.id;
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
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
