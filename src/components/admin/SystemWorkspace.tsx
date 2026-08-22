import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Globe2, Mail, Megaphone, MessageSquare, Printer, QrCode, Settings, ShieldCheck, Store, Target } from 'lucide-react';
import { BarbershopProfileManagement } from './BarbershopProfileManagement';
import { SettingsManagement, type SettingsTab } from './SettingsManagement';
import { AdminPageHeader } from './shared/AdminPageHeader';

type SystemTab = 'unit' | 'preferences' | 'availability' | 'notifications' | 'qrcode' | 'print' | 'audit' | 'meta_ads' | 'google_ads';
type SystemGroupId = 'operation' | 'communication' | 'marketing' | 'security';

type SystemOption = { id: SystemTab; label: string; description: string; icon: React.ElementType };
type SystemGroup = { id: SystemGroupId; label: string; summary: string; icon: React.ElementType; options: SystemOption[] };

const groups: SystemGroup[] = [
  {
    id: 'operation',
    label: 'Operação da unidade',
    summary: 'Perfil, agenda, preferências e impressões',
    icon: Store,
    options: [
      { id: 'unit', label: 'Unidade', description: 'Nome, endereço e identidade da operação', icon: Store },
      { id: 'preferences', label: 'Preferências', description: 'E-mail, avisos e preferências gerais', icon: Settings },
      { id: 'availability', label: 'Agenda', description: 'Disponibilidade e regras de atendimento', icon: CalendarDays },
      { id: 'print', label: 'Impressões', description: 'Comprovantes, relatórios e QR Code', icon: Printer },
    ],
  },
  {
    id: 'communication',
    label: 'Comunicação e canais',
    summary: 'WhatsApp, notificações, e-mail e QR Code',
    icon: MessageSquare,
    options: [
      { id: 'notifications', label: 'Notificações', description: 'E-mail e mensagens de atendimento', icon: Mail },
      { id: 'qrcode', label: 'QR Code', description: 'Conexão e acesso rápido ao WhatsApp', icon: QrCode },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing e integrações',
    summary: 'Meta Ads e Google Ads',
    icon: Megaphone,
    options: [
      { id: 'meta_ads', label: 'Meta Ads', description: 'Facebook, Instagram e campanhas Meta', icon: Target },
      { id: 'google_ads', label: 'Google Ads', description: 'Campanhas, métricas e conta Google', icon: Globe2 },
    ],
  },
  {
    id: 'security',
    label: 'Segurança e auditoria',
    summary: 'Registros e acompanhamento de alterações',
    icon: ShieldCheck,
    options: [
      { id: 'audit', label: 'Auditoria', description: 'Histórico de ações administrativas', icon: ShieldCheck },
    ],
  },
];

const groupForTab = (tab: SystemTab): SystemGroupId => groups.find((group) => group.options.some((option) => option.id === tab))?.id || 'operation';

export const SystemWorkspace: React.FC<{ initialTab?: SystemTab; onOpenCampaigns?: (provider?: 'meta' | 'google') => void }> = ({ initialTab = 'unit', onOpenCampaigns }) => {
  const [activeTab, setActiveTab] = useState<SystemTab>(initialTab);
  const [openGroup, setOpenGroup] = useState<SystemGroupId | null>(() => initialTab === 'unit' ? null : groupForTab(initialTab as SystemTab));

  useEffect(() => {
    setActiveTab(initialTab);
    setOpenGroup(initialTab === 'unit' ? null : groupForTab(initialTab as SystemTab));
  }, [initialTab]);

  const activeOption = useMemo(() => groups.flatMap((group) => group.options).find((option) => option.id === activeTab), [activeTab]);

  const selectOption = (groupId: SystemGroupId, tab: SystemTab) => {
    setOpenGroup(groupId);
    setActiveTab(tab);
  };

  const renderContent = () => {
    if (activeTab === 'unit') return <BarbershopProfileManagement />;
    const settingsTab: SettingsTab = activeTab === 'preferences'
      ? 'email'
      : activeTab === 'notifications'
        ? 'whatsapp'
        : activeTab;
    return <SettingsManagement initialTab={settingsTab} hideTabs onOpenCampaigns={onOpenCampaigns} />;
  };

  return (
    <div className="admin-system-workspace min-w-0 space-y-4">
      <AdminPageHeader icon={Settings} title="Configurações do Sistema" stats={[{ label: 'seção', value: activeOption?.label || 'Unidade' }]} />

      <div className="space-y-3" aria-label="Seções de configurações">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroup === group.id;
          return (
            <section key={group.id} className={`overflow-hidden rounded-xl border bg-surface-card transition-colors ${isOpen ? 'border-gold-base/40' : 'border-border-subtle'}`}>
              <button type="button" onClick={() => setOpenGroup((current) => current === group.id ? null : group.id)} aria-expanded={isOpen} className="flex min-h-[74px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-base sm:px-5">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOpen ? 'bg-gold-base/10 text-gold-base' : 'bg-surface-base text-content-muted'}`}><GroupIcon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-content-base sm:text-[15px]">{group.label}</span><span className="mt-0.5 block truncate text-xs text-content-muted">{group.summary}</span></span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-content-muted transition-transform duration-200 ${isOpen ? 'rotate-180 text-gold-base' : ''}`} />
              </button>

              {isOpen && <div className="border-t border-border-subtle px-3 pb-4 pt-3 sm:px-4 sm:pb-5"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{group.options.map((option) => { const OptionIcon = option.icon; const isActive = activeTab === option.id; return <button key={option.id} type="button" onClick={() => selectOption(group.id, option.id)} aria-current={isActive ? 'page' : undefined} className={`flex min-h-[64px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${isActive ? 'border-gold-base/40 bg-gold-base/10' : 'border-border-subtle bg-surface-base hover:border-border-strong hover:bg-surface-card'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-gold-base/15 text-gold-base' : 'bg-surface-card text-content-muted'}`}><OptionIcon className="h-4 w-4" /></span><span className="min-w-0"><span className={`block truncate text-xs font-bold ${isActive ? 'text-gold-base' : 'text-content-base'}`}>{option.label}</span><span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-content-muted">{option.description}</span></span></button>; })}</div><div className="mt-4 border-t border-border-subtle pt-4">{renderContent()}</div></div>}
            </section>
          );
        })}
      </div>
    </div>
  );
};
