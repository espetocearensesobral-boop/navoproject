import React, { useState } from 'react';
import { BarChart3, Globe2, Target } from 'lucide-react';
import { MetaAdsManagement } from './MetaAdsManagement';
import { GoogleAdsManagement } from './GoogleAdsManagement';
import { CAMPAIGNS_DEMO_MODE } from '../../services/campaignDemoData';

interface CampaignsWorkspaceProps {
  onOpenMetaSettings?: () => void;
  onOpenGoogleSettings?: () => void;
  initialProvider?: 'meta' | 'google';
}

export const CampaignsWorkspace: React.FC<CampaignsWorkspaceProps> = ({ onOpenMetaSettings, onOpenGoogleSettings, initialProvider = 'meta' }) => {
  const [provider, setProvider] = useState<'meta' | 'google'>(initialProvider);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-card p-2">
        <div className="flex min-w-0 items-center gap-2 px-2">
          <BarChart3 className="h-4 w-4 shrink-0 text-gold-base" />
          <div className="min-w-0"><p className="text-xs font-bold text-content-base">Canais de campanha</p><p className="truncate text-[11px] text-content-muted">Escolha o canal para criar e acompanhar suas campanhas.</p></div>
        </div>
        <div className="flex w-full gap-1 sm:w-auto">
          <button type="button" onClick={() => setProvider('meta')} className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold transition-colors sm:flex-none ${provider === 'meta' ? 'bg-gold-base text-content-on-accent' : 'text-content-muted hover:bg-surface-base hover:text-content-base'}`} aria-pressed={provider === 'meta'}><Target className="h-3.5 w-3.5" /> Meta Ads</button>
          <button type="button" onClick={() => setProvider('google')} className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold transition-colors sm:flex-none ${provider === 'google' ? 'bg-blue-500 text-white' : 'text-content-muted hover:bg-surface-base hover:text-content-base'}`} aria-pressed={provider === 'google'}><Globe2 className="h-3.5 w-3.5" /> Google Ads</button>
        </div>
      </div>
      {CAMPAIGNS_DEMO_MODE && <div className="rounded-lg border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-xs text-blue-100" role="status"><strong>Apresentação:</strong> os dados exibidos são demonstrativos e não alteram contas, campanhas ou orçamentos reais.</div>}
      {provider === 'meta' ? <MetaAdsManagement onOpenSettings={onOpenMetaSettings} /> : <GoogleAdsManagement onOpenSettings={onOpenGoogleSettings} />}
    </div>
  );
};
