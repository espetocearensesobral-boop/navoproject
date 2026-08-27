import React, { useEffect, useRef, useState } from"react";
import {
 CalendarDays,
 ChevronDown,
 Globe2,
 MessageSquare,
 Printer,
 QrCode,
 Settings,
 ShieldCheck,
 Store,
 Target,
} from"lucide-react";
import { BarbershopProfileManagement } from"./BarbershopProfileManagement";
import { SettingsManagement } from"./SettingsManagement";
import { AdminPageHeader } from"./shared/AdminPageHeader";

export type SystemTab =
 |"unit"
 |"preferences"
 |"availability"
 |"notifications"
 |"qrcode"
 |"print"
 |"audit"
 |"meta_ads"
 |"google_ads";

export type SystemSectionId =
 |"operation"
 |"notifications"
 |"qrcode"
 |"meta_ads"
 |"google_ads"
 |"audit";

type OperationSubTab ="unit"|"preferences"|"availability"|"print";

type OperationOption = {
 id: OperationSubTab;
 label: string;
 description: string;
 icon: React.ElementType;
};

const operationOptions: OperationOption[] = [
 {
 id:"unit",
 label:"Unidade",
 description:"Nome, endereço, logotipo e identidade visual",
 icon: Store,
 },
 {
 id:"preferences",
 label:"Preferências",
 description:"E-mail (SMTP), avisos e configurações gerais",
 icon: Settings,
 },
 {
 id:"availability",
 label:"Agenda",
 description:"Horários de funcionamento e regras de atendimento",
 icon: CalendarDays,
 },
 {
 id:"print",
 label:"Impressões",
 description:"Comprovantes térmicos, relatórios e padrões de cupom",
 icon: Printer,
 },
];

type SystemSectionItem = {
 id: SystemSectionId;
 label: string;
 category: string;
 description: string;
 icon: React.ElementType;
};

const systemSections: SystemSectionItem[] = [
 {
 id:"operation",
 label:"Operação da unidade",
 category:"Operação",
 description:"Perfil, agenda, preferências de e-mail e regras de impressão",
 icon: Store,
 },
 {
 id:"notifications",
 label:"Notificações WhatsApp",
 category:"Comunicação",
 description:"Notificações automáticas, regras de mensagens e atendimento",
 icon: MessageSquare,
 },
 {
 id:"qrcode",
 label:"QR Code de Conexão",
 category:"Conexão",
 description:"Pareamento e acesso rápido ao canal oficial WhatsApp",
 icon: QrCode,
 },
 {
 id:"meta_ads",
 label:"Meta Ads",
 category:"Marketing",
 description:"Pixel, rastreamento de conversões e campanhas Meta (Facebook / Instagram)",
 icon: Target,
 },
 {
 id:"google_ads",
 label:"Google Ads",
 category:"Marketing",
 description:"Tags globais de conversão e campanhas na rede de busca Google",
 icon: Globe2,
 },
 {
 id:"audit",
 label:"Auditoria e Segurança",
 category:"Segurança",
 description:"Histórico completo de logs administrativos e alterações no sistema",
 icon: ShieldCheck,
 },
];

const getSectionFromTab = (tab?: string): SystemSectionId => {
 if (
 tab ==="unit"||
 tab ==="preferences"||
 tab ==="availability"||
 tab ==="print"
 ) {
 return"operation";
 }
 if (
 tab ==="notifications"||
 tab ==="qrcode"||
 tab ==="meta_ads"||
 tab ==="google_ads"||
 tab ==="audit"
 ) {
 return tab;
 }
 return"operation";
};

const getOperationSubTab = (tab?: string): OperationSubTab => {
 if (
 tab ==="unit"||
 tab ==="preferences"||
 tab ==="availability"||
 tab ==="print"
 ) {
 return tab;
 }
 return"unit";
};

export const SystemWorkspace: React.FC<{
 initialTab?: SystemTab | string;
 onOpenCampaigns?: (provider?:"meta"|"google") => void;
}> = ({ initialTab ="unit", onOpenCampaigns }) => {
 const [openSection, setOpenSection] = useState<SystemSectionId | null>(() =>
 getSectionFromTab(initialTab),
 );
 const [activeOperationTab, setActiveOperationTab] = useState<OperationSubTab>(
 () => getOperationSubTab(initialTab),
 );
 const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

 useEffect(() => {
 if (initialTab) {
 setOpenSection(getSectionFromTab(initialTab));
 setActiveOperationTab(getOperationSubTab(initialTab));
 }
 }, [initialTab]);

 const toggleSection = (id: SystemSectionId) => {
 setOpenSection((current) => {
 const next = current === id ? null : id;
 if (next && sectionRefs.current[next]) {
 setTimeout(() => {
 sectionRefs.current[next]?.scrollIntoView({
 behavior:"smooth",
 block:"nearest",
 });
 }, 100);
 }
 return next;
 });
 };

 const renderSectionContent = (id: SystemSectionId) => {
 switch (id) {
 case"operation":
 return (
 <div className="space-y-4">
 {/* Seletor de Submódulos da Operação */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
 {operationOptions.map((opt) => {
 const OptIcon = opt.icon;
 const isSelected = activeOperationTab === opt.id;
 return (
 <button
 key={opt.id}
 type="button"
 onClick={() => setActiveOperationTab(opt.id)}
 className={`flex items-center gap-2.5 p-2.5 rounded-[var(--admin-radius-md)] text-left transition-all cursor-pointer ${
 isSelected
 ?"bg-[var(--admin-accent)]/15 text-[var(--admin-text-main)] font-semibold"
 :"bg-[var(--admin-bg)]/60 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-bg)]"
 }`}
 >
 <span
 className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--admin-radius-sm)] ${
 isSelected
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
 :"bg-[var(--admin-surface)] text-[var(--admin-text-muted)]"
 }`}
 >
 <OptIcon className="h-3.5 w-3.5"/>
 </span>
 <div className="min-w-0 flex-1">
 <span
 className={`block truncate text-xs font-semibold ${
 isSelected
 ?"text-[var(--admin-text-main)]"
 :"text-[var(--admin-text-muted)]"
 }`}
 >
 {opt.label}
 </span>
 <span className="block truncate text-[10px] text-[var(--admin-text-muted)] opacity-80">
 {opt.description}
 </span>
 </div>
 </button>
 );
 })}
 </div>

 {/* Conteúdo Renderizado do Submódulo Selecionado */}
 <div className="pt-2">
 {activeOperationTab ==="unit"&& <BarbershopProfileManagement />}
 {activeOperationTab ==="preferences"&& (
 <SettingsManagement initialTab="email"hideTabs />
 )}
 {activeOperationTab ==="availability"&& (
 <SettingsManagement initialTab="availability"hideTabs />
 )}
 {activeOperationTab ==="print"&& (
 <SettingsManagement initialTab="print"hideTabs />
 )}
 </div>
 </div>
 );

 case"notifications":
 return <SettingsManagement initialTab="whatsapp"hideTabs />;

 case"qrcode":
 return <SettingsManagement initialTab="qrcode"hideTabs />;

 case"meta_ads":
 return (
 <SettingsManagement
 initialTab="meta_ads"
 hideTabs
 onOpenCampaigns={onOpenCampaigns}
 />
 );

 case"google_ads":
 return (
 <SettingsManagement
 initialTab="google_ads"
 hideTabs
 onOpenCampaigns={onOpenCampaigns}
 />
 );

 case"audit":
 return <SettingsManagement initialTab="audit"hideTabs />;

 default:
 return null;
 }
 };

 const activeSectionInfo = systemSections.find((sec) => sec.id === openSection);

 return (
 <div className="admin-system-workspace min-w-0 space-y-4">
 <AdminPageHeader
 icon={Settings}
 title="Configurações do Sistema"
 stats={[
 {
 label:"seção ativa",
 value: activeSectionInfo ? activeSectionInfo.label :"Nenhuma",
 },
 {
 label:"total de módulos",
 value: systemSections.length,
 },
 ]}
 />

 <div className="space-y-3"aria-label="Seções de configurações">
 {systemSections.map((section) => {
 const SectionIcon = section.icon;
 const isOpen = openSection === section.id;

 return (
 <section
 key={section.id}
 ref={(el) => {
 sectionRefs.current[section.id] = el;
 }}
 tabIndex={-1}
 className={`scroll-mt-4 sm:scroll-mt-6 overflow-hidden rounded-[var(--admin-radius-lg)] transition-all duration-200 focus:outline-none ${
 isOpen
 ?"bg-[var(--admin-surface)] ring-1 ring-[var(--admin-accent)]/25 shadow-xs"
 :"bg-[var(--admin-surface)]/70 hover:bg-[var(--admin-surface)]"
 }`}
 >
 {/* Cabeçalho do Menu Individual */}
 <button
 type="button"
 onClick={() => toggleSection(section.id)}
 aria-expanded={isOpen}
 className="flex min-h-[60px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors sm:px-5 cursor-pointer"
 >
 <span
 className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-md)] transition-colors ${
 isOpen
 ?"bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]"
 :"bg-[var(--admin-bg)]/80 text-[var(--admin-text-muted)]"
 }`}
 >
 <SectionIcon className="h-4 w-4"/>
 </span>

 <span className="min-w-0 flex-1">
 <span className="flex flex-wrap items-center gap-2">
 <span className="truncate text-sm font-semibold text-[var(--admin-text-main)]">
 {section.label}
 </span>
 <span className="inline-flex items-center rounded-[var(--admin-radius-full)] bg-[var(--admin-bg)] px-2 py-0.5 text-[9px] font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider">
 {section.category}
 </span>
 </span>
 <span className="mt-0.5 block truncate text-xs text-[var(--admin-text-muted)]">
 {section.description}
 </span>
 </span>

 <ChevronDown
 className={`h-4 w-4 shrink-0 text-[var(--admin-text-muted)] transition-transform duration-200 ${
 isOpen ?"rotate-180 text-[var(--admin-accent)]":""
 }`}
 />
 </button>

 {/* Conteúdo Renderizado quando o Menu está Expandido */}
 {isOpen && (
 <div className="px-4 pb-5 pt-1 sm:px-5 animate-in fade-in duration-200">
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
