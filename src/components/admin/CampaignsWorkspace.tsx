import React, { useEffect, useRef, useState } from "react";
import { BarChart3, ChevronDown, Globe2, Target } from "lucide-react";
import { MetaAdsManagement } from "./MetaAdsManagement";
import { GoogleAdsManagement } from "./GoogleAdsManagement";
import { CAMPAIGNS_DEMO_MODE } from "../../services/campaignDemoData";

interface CampaignsWorkspaceProps {
  onOpenMetaSettings?: () => void;
  onOpenGoogleSettings?: () => void;
  initialProvider?: "meta" | "google";
}

type CampaignProvider = "meta" | "google";

type CampaignGroup = {
  id: CampaignProvider;
  label: string;
  summary: string;
  icon: React.ElementType;
};

const groups: CampaignGroup[] = [
  {
    id: "meta",
    label: "Meta Ads",
    summary: "Facebook, Instagram e campanhas Meta",
    icon: Target,
  },
  {
    id: "google",
    label: "Google Ads",
    summary: "Pesquisa, métricas e conta Google",
    icon: Globe2,
  },
];

export const CampaignsWorkspace: React.FC<CampaignsWorkspaceProps> = ({
  onOpenMetaSettings,
  onOpenGoogleSettings,
  initialProvider,
}) => {
  const [openProvider, setOpenProvider] = useState<CampaignProvider | null>(
    () => initialProvider || null,
  );
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (initialProvider) {
      setOpenProvider(initialProvider);
    }
  }, [initialProvider]);

  useEffect(() => {
    if (openProvider && sectionRefs.current[openProvider]) {
      const el = sectionRefs.current[openProvider];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.focus({ preventScroll: true });
      }
    }
  }, [openProvider]);

  const toggleProvider = (provider: CampaignProvider) => {
    setOpenProvider((current) => (current === provider ? null : provider));
  };

  const renderProviderContent = (provider: CampaignProvider) => {
    if (provider === "meta")
      return <MetaAdsManagement onOpenSettings={onOpenMetaSettings} />;
    return <GoogleAdsManagement onOpenSettings={onOpenGoogleSettings} />;
  };

  return (
    <div className="admin-campaigns-workspace min-w-0 space-y-4">
      {CAMPAIGNS_DEMO_MODE && (
        <div
          className="rounded-[var(--admin-radius-md)] border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-200"
          role="status"
        >
          <strong>Apresentação:</strong> os dados exibidos são demonstrativos e
          não alteram contas, campanhas ou orçamentos reais.
        </div>
      )}

      <div className="space-y-3" aria-label="Canais de campanha">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openProvider === group.id;
          return (
            <section
              key={group.id}
              ref={(el) => {
                sectionRefs.current[group.id] = el;
              }}
              tabIndex={-1}
              className={`scroll-mt-4 sm:scroll-mt-6 overflow-hidden rounded-[var(--admin-radius-lg)] border bg-[var(--admin-surface)] transition-colors focus:outline-none ${isOpen ? "border-[var(--admin-accent)]/40 shadow-xs ring-1 ring-[var(--admin-accent)]/20" : "border-[var(--admin-border)]"}`}
            >
              <button
                type="button"
                onClick={() => toggleProvider(group.id)}
                aria-expanded={isOpen}
                className="flex min-h-[74px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-bg)] sm:px-5 cursor-pointer"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--admin-radius-lg)] ${isOpen ? "bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]" : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)]"}`}
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
                  <div className="min-w-0">
                    {renderProviderContent(group.id)}
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
