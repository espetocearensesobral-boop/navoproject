import React, { useEffect, useState } from 'react';
import { BarChart3, ChevronDown, Globe2, Target } from 'lucide-react';
import { MetaAdsManagement } from './MetaAdsManagement';
import { GoogleAdsManagement } from './GoogleAdsManagement';
import { CAMPAIGNS_DEMO_MODE } from '../../services/campaignDemoData';

interface CampaignsWorkspaceProps {
  onOpenMetaSettings?: () => void;
  onOpenGoogleSettings?: () => void;
  initialProvider?: 'meta' | 'google';
}

type CampaignProvider = 'meta' | 'google';
type CampaignGroupId = 'channels';

type CampaignOption = {
  id: CampaignProvider;
  label: string;
  description: string;
  icon: React.ElementType;
};

type CampaignGroup = {
  id: CampaignGroupId;
  label: string;
  summary: string;
  icon: React.ElementType;
  options: CampaignOption[];
};

const groups: CampaignGroup[] = [
  {
    id: 'channels',
    label: 'Canais de campanha',
    summary: 'Meta Ads e Google Ads para divulgação local',
    icon: BarChart3,
    options: [
      { id: 'meta', label: 'Meta Ads', description: 'Facebook, Instagram e campanhas Meta', icon: Target },
      { id: 'google', label: 'Google Ads', description: 'Pesquisa, métricas e conta Google', icon: Globe2 },
    ],
  },
];

export const CampaignsWorkspace: React.FC<CampaignsWorkspaceProps> = ({ onOpenMetaSettings, onOpenGoogleSettings, initialProvider }) => {
  const [provider, setProvider] = useState<CampaignProvider>(initialProvider || 'meta');
  const [openGroup, setOpenGroup] = useState<CampaignGroupId | null>(() => initialProvider ? 'channels' : null);

  useEffect(() => {
    if (initialProvider) {
      setProvider(initialProvider);
      setOpenGroup('channels');
    } else {
      setOpenGroup(null);
    }
  }, [initialProvider]);

  const selectProvider = (nextProvider: CampaignProvider) => {
    setProvider(nextProvider);
    setOpenGroup('channels');
  };

  const isOpen = openGroup === 'channels';

  return (
    <div className="admin-campaigns-workspace min-w-0 space-y-4">
      {CAMPAIGNS_DEMO_MODE && <div className="rounded-lg border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-xs text-blue-100" role="status"><strong>Apresentação:</strong> os dados exibidos são demonstrativos e não alteram contas, campanhas ou orçamentos reais.</div>}

      <section className={`overflow-hidden rounded-xl border bg-surface-card transition-colors ${isOpen ? 'border-gold-base/40' : 'border-border-subtle'}`}>
        <button type="button" onClick={() => setOpenGroup((current) => current === 'channels' ? null : 'channels')} aria-expanded={isOpen} className="flex min-h-[74px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-base sm:px-5">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOpen ? 'bg-gold-base/10 text-gold-base' : 'bg-surface-base text-content-muted'}`}><BarChart3 className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-content-base sm:text-[15px]">Canais de campanha</span><span className="mt-0.5 block truncate text-xs text-content-muted">Meta Ads e Google Ads para divulgação local</span></span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-content-muted transition-transform duration-200 ${isOpen ? 'rotate-180 text-gold-base' : ''}`} />
        </button>

        {isOpen && <div className="border-t border-border-subtle px-3 pb-4 pt-3 sm:px-4 sm:pb-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {groups[0].options.map((option) => { const OptionIcon = option.icon; const isActive = provider === option.id; return <button key={option.id} type="button" onClick={() => selectProvider(option.id)} aria-current={isActive ? 'page' : undefined} className={`flex min-h-[64px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${isActive ? 'border-gold-base/40 bg-gold-base/10' : 'border-border-subtle bg-surface-base hover:border-border-strong hover:bg-surface-card'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-gold-base/15 text-gold-base' : 'bg-surface-card text-content-muted'}`}><OptionIcon className="h-4 w-4" /></span><span className="min-w-0"><span className={`block truncate text-xs font-bold ${isActive ? 'text-gold-base' : 'text-content-base'}`}>{option.label}</span><span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-content-muted">{option.description}</span></span></button>; })}
          </div>
          <div className="mt-4 border-t border-border-subtle pt-4">{provider === 'meta' ? <MetaAdsManagement onOpenSettings={onOpenMetaSettings} /> : <GoogleAdsManagement onOpenSettings={onOpenGoogleSettings} />}</div>
        </div>}
      </section>
    </div>
  );
};
