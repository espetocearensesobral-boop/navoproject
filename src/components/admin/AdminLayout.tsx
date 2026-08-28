import React, { useState, useRef } from"react";
import { usePullToRefresh } from"../../hooks/usePullToRefresh";
import { PullToRefreshIndicator } from"../shared/PullToRefreshIndicator";
import { NavoHomeView } from"./NavoHomeView";
import { ScheduleGrid } from"./ScheduleGrid";
import { ReceiptsManagement } from"./ReceiptsManagement";
import { FinancialStatementManagement } from"./FinancialStatementManagement";
import { ExpensesManagement } from"./ExpensesManagement";
import { ClientsManagement } from"./ClientsManagement";
import { WaitingQueue } from"./WaitingQueue";
import { AdminAuthView } from"./AdminAuthView";
import { CatalogWorkspace } from"./CatalogWorkspace";
import { ReportsWorkspace } from"./ReportsWorkspace";
import { NavoRewardsAdmin } from"./NavoRewardsAdmin";
import { SubscriptionsManagement } from"./SubscriptionsManagement";
import { FollowUpManagement } from"./FollowUpManagement";
import { BirthdaysManagement } from"./BirthdaysManagement";
import { AppointmentRemindersManagement } from"./AppointmentRemindersManagement";
import { SystemWorkspace } from"./SystemWorkspace";
import { AdminNotificationCenter } from"./AdminNotificationCenter";
import { CampaignsWorkspace } from"./CampaignsWorkspace";
import { WhatsAppInboxManagement } from"./WhatsAppInboxManagement";
import { authFetch } from"../../lib/api";
import { useTheme } from"../../contexts/ThemeContext";
import { useAdminOperationNotifications } from"../../hooks/useAdminOperationNotifications";
import { useDialogFocus } from"../../hooks/useDialogFocus";
import { hapticLight } from"../../lib/haptics";
import {
 Calendar,
 Clock,
 UserCheck,
 Menu,
 MessageCircle,
 X,
 ChevronRight,
 ChevronDown,
 TrendingUp,
 LogOut,
 Wallet,
 DollarSign,
 ArrowDownRight,
 FileText,
 Package,
 Award,
 Gift,
 CreditCard,
 Star,
 History,
 Cake,
 Zap,
 Scissors,
 MoreHorizontal,
 Store,
 Settings,
 Megaphone,
 Sun,
 Moon,
} from"lucide-react";

export type AdminTab =
 |"dashboard"
 |"agenda"
 |"queue"
 |"atendimento"
 |"relatorios"
 |"campanhas"
 |"financeiro_recebimentos"
 |"financeiro_extrato"
 |"financeiro_saidas"
 |"clientes"
 |"catalogo"
 |"relacionamento_overview"
 |"relacionamento_reviews"
 |"relacionamento_followup"
 |"relacionamento_birthdays"
 |"fidelidade"
 |"premios"
 |"assinaturas"
 |"indicacoes"
 |"lembretes"
 |"sistema";

const ADMIN_ACTIVE_TAB_KEY ="navo-admin-active-tab";
const ADMIN_TAB_VALUES: AdminTab[] = [
"dashboard",
"agenda",
"queue",
"atendimento",
"relatorios",
"campanhas",
"financeiro_recebimentos",
"financeiro_extrato",
"financeiro_saidas",
"clientes",
"catalogo",
"relacionamento_overview",
"relacionamento_reviews",
"relacionamento_followup",
"relacionamento_birthdays",
"fidelidade",
"premios",
"assinaturas",
"indicacoes",
"lembretes",
"sistema",
];

const getStoredAdminTab = (): AdminTab => {
 if (typeof window ==="undefined") return"dashboard";
 try {
 const storedTab = window.sessionStorage.getItem(ADMIN_ACTIVE_TAB_KEY);
 const legacyTabMap: Record<string, AdminTab> = {
 financeiro:"financeiro_recebimentos",
 financeiro_relatorios:"relatorios",
 rewards:"premios",
 subscriptions:"assinaturas",
 catalogo_subscriptions:"assinaturas",
 servicos:"catalogo",
 profissionais:"catalogo",
 produtos:"catalogo",
 relacionamento:"relacionamento_overview",
 relacionamento_loyalty:"fidelidade",
 relacionamento_followup:"relacionamento_followup",
 relacionamento_rewards:"premios",
 relacionamento_referrals:"indicacoes",
 relacionamento_reviews:"relacionamento_reviews",
 followup:"relacionamento_followup",
 aniversariantes:"relacionamento_birthdays",
 barbearia:"sistema",
 settings:"sistema",
 settings_agenda:"sistema",
 settings_print:"sistema",
 audit:"sistema",
 whatsapp:"sistema",
 qrcode:"sistema",
 };
 const normalizedTab = (storedTab && legacyTabMap[storedTab]) || storedTab;
 return normalizedTab && ADMIN_TAB_VALUES.includes(normalizedTab as AdminTab)
 ? (normalizedTab as AdminTab)
 :"dashboard";
 } catch {
 return"dashboard";
 }
};

export const AdminLayout: React.FC = () => {
 const { theme, setTheme } = useTheme();
 const [isAuthorized, setIsAuthorized] = useState(false);
 const {
 isSupported: notificationsSupported,
 permission: notificationPermission,
 toggleNotifications,
 backgroundPushEnabled,
 notificationsBusy,
 } = useAdminOperationNotifications(isAuthorized);
 const [activeTab, setActiveTab] = useState<AdminTab>(() =>
 getStoredAdminTab(),
 );
 const [sidebarOpen, setSidebarOpen] = useState(false);
 const [isLoadingAuth, setIsLoadingAuth] = useState(true);
 const [adminName, setAdminName] = useState("Admin");
 const [systemInitialTab, setSystemInitialTab] = useState<
 |"unit"
 |"preferences"
 |"availability"
 |"notifications"
 |"qrcode"
 |"print"
 |"audit"
 |"meta_ads"
 |"google_ads"
 >("unit");
 const [campaignInitialProvider, setCampaignInitialProvider] = useState<
"meta"|"google"| null
 >(null);

 React.useEffect(() => {
 try {
 window.sessionStorage.setItem(ADMIN_ACTIVE_TAB_KEY, activeTab);
 } catch {
 // A navegação válida não deve falhar se o armazenamento estiver indisponível.
 }
 }, [activeTab]);

 const mainRef = useRef<HTMLElement>(null);
 const sidebarRef = useRef<HTMLElement>(null);
 useDialogFocus(sidebarOpen, sidebarRef);
 const notificationsActive =
 notificationsSupported &&
 notificationPermission ==="granted"&&
 backgroundPushEnabled;

 const toggleTheme = () => {
 setTheme(theme ==="dark"?"light":"dark");
 hapticLight();
 };

 const openMobileNavigation = () => {
 hapticLight();
 setSidebarOpen(true);
 };

 const closeMobileNavigation = () => {
 hapticLight();
 setSidebarOpen(false);
 };

 const scrollSidebarNavigationToItem = (tab: AdminTab, mobile = false) => {
 window.requestAnimationFrame(() => {
 const navigation = document.querySelector<HTMLElement>(
 mobile
 ? '[data-admin-sidebar-navigation="mobile"]'
 : '[data-admin-sidebar-navigation="desktop"]',
 );
 const target = navigation?.querySelector<HTMLElement>(
 `[data-admin-sidebar-item="${tab}"]`,
 );
 if (!navigation || !target) return;

 const navigationRect = navigation.getBoundingClientRect();
 const targetRect = target.getBoundingClientRect();
 const targetTop =
 navigation.scrollTop +
 (targetRect.top - navigationRect.top) -
 (navigation.clientHeight - targetRect.height) / 2;

 navigation.scrollTo({
 top: Math.max(0, targetTop),
 behavior:"smooth",
 });
 });
 };

 const handleSidebarTabChange = (tab: AdminTab, mobile = false) => {
 if (tab ==="campanhas") setCampaignInitialProvider(null);
 setActiveTab(tab);
 if (mobile) {
 hapticLight();
 setSidebarOpen(false);
 return;
 }
 scrollSidebarNavigationToItem(tab);
 };

 const {
 pullDistance,
 isRefreshing,
 handlers: pullToRefreshHandlers,
 } = usePullToRefresh(mainRef, {
 onRefresh: async () => {
 window.dispatchEvent(new CustomEvent("adminRefresh"));
 await new Promise((resolve) => setTimeout(resolve, 800)); // wait a bit for data to load
 },
 });

 // Padroniza o foco inicial de todos os modais do Admin sem exigir refs em cada tela.
 React.useEffect(() => {
 const focusFirstModalField = () => {
 const modal = document.querySelector<HTMLElement>(
 '.admin-shell .fixed.inset-0 form, .admin-shell .fixed.inset-0 [role="dialog"], .admin-shell .fixed.inset-0 .admin-modal',
 );
 if (!modal || modal.contains(document.activeElement)) return;
 const firstField = modal.querySelector<HTMLElement>(
 '[data-autofocus], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button[type="submit"]:not([disabled])',
 );
 firstField?.focus();
 };

 const observer = new MutationObserver(() =>
 window.requestAnimationFrame(focusFirstModalField),
 );
 observer.observe(document.body, { childList: true, subtree: true });
 return () => observer.disconnect();
 }, []);

 // A autorização vem exclusivamente da sessão HTTP e do perfil no banco.
 React.useEffect(() => {
 setIsLoadingAuth(true);
 authFetch("/api/auth/me")
 .then(async (res) => {
 if (!res.ok) throw new Error("Sessão inválida");
 return res.json();
 })
 .then((user) => {
 if (user?.role !=="admin") throw new Error("Acesso restrito");
 setIsAuthorized(true);
 setAdminName(user.name ||"Admin");
 })
 .catch(() => {
 setIsAuthorized(false);
 })
 .finally(() => {
 setIsLoadingAuth(false);
 });
 }, []);

 if (isLoadingAuth) {
 return (
 <div className="flex h-[100dvh] items-center justify-center bg-[var(--admin-bg)]">
 <div className="w-8 h-8 border-4 border-[var(--admin-accent)]/20 border-t-gold-base rounded-[var(--admin-radius-full)] animate-spin"/>
 </div>
 );
 }

 if (!isAuthorized) {
 return (
 <AdminAuthView
 onLoginSuccess={(user) => {
 setIsAuthorized(true);
 setAdminName(user.name ||"Admin");
 }}
 />
 );
 }

 const navItems = [
 {
 id:"dashboard"as AdminTab,
 label:"Hoje",
 icon: TrendingUp,
 description:"Resumo e alertas do dia",
 },
 {
 id:"agenda"as AdminTab,
 label:"Agenda",
 icon: Calendar,
 description:"Horários, encaixes e bloqueios",
 },
 {
 id:"queue"as AdminTab,
 label:"Fila",
 icon: Clock,
 description:"Atendimentos em andamento",
 },
 {
 id:"atendimento"as AdminTab,
 label:"Conversas",
 icon: MessageCircle,
 description:"Caixa de entrada do NavoBot e WhatsApp",
 },
 {
 id:"relatorios"as AdminTab,
 label:"Relatórios",
 icon: FileText,
 description:"Operação e financeiro",
 },
 {
 id:"campanhas"as AdminTab,
 label:"Campanhas",
 icon: Megaphone,
 description:"Crie campanhas e acompanhe resultados",
 },
 {
 id:"financeiro_recebimentos"as AdminTab,
 label:"Recebimentos",
 icon: Wallet,
 description:"Pendências e recebimentos confirmados",
 },
 {
 id:"financeiro_extrato"as AdminTab,
 label:"Extrato",
 icon: DollarSign,
 description:"Livro-caixa persistido",
 },
 {
 id:"financeiro_saidas"as AdminTab,
 label:"Saídas",
 icon: ArrowDownRight,
 description:"Despesas e pagamentos",
 },
 {
 id:"clientes"as AdminTab,
 label:"Clientes",
 icon: UserCheck,
 description:"Base de clientes",
 },
 {
 id:"catalogo"as AdminTab,
 label:"Catálogo",
 icon: Package,
 description:"Serviços, equipe e estoque",
 },
 {
 id:"relacionamento_overview"as AdminTab,
 label:"Visão geral do CRM",
 icon: Award,
 description:"Métricas de satisfação, retenção e fidelização",
 },
 {
 id:"relacionamento_reviews"as AdminTab,
 label:"Avaliações & NPS",
 icon: Star,
 description:"Feedbacks recebidos, prioridades e tratamento",
 },
 {
 id:"relacionamento_followup"as AdminTab,
 label:"Follow-up",
 icon: History,
 description:"Clientes para reativação e pós-atendimento",
 },
 {
 id:"relacionamento_birthdays"as AdminTab,
 label:"Aniversariantes",
 icon: Cake,
 description:"Clientes aniversariantes e ações de relacionamento",
 },
 {
 id:"fidelidade"as AdminTab,
 label:"Programa de fidelidade",
 icon: Award,
 description:"Níveis, pontos, saldos e regras do clube",
 },
 {
 id:"premios"as AdminTab,
 label:"Catálogo de prêmios",
 icon: Gift,
 description:"Benefícios, cupons e resgates",
 },
 {
 id:"assinaturas"as AdminTab,
 label:"Plano por assinatura",
 icon: CreditCard,
 description:"Planos recorrentes, benefícios e membros",
 },
 {
 id:"indicacoes"as AdminTab,
 label:"Programa de indicações",
 icon: UserCheck,
 description:"Links, bônus e crescimento por indicação",
 },
 {
 id:"lembretes"as AdminTab,
 label:"Lembretes WhatsApp",
 icon: Zap,
 description:"Régua de comunicação e confirmações",
 },
 {
 id:"sistema"as AdminTab,
 label:"Sistema",
 icon: Settings,
 description:"Unidade, integrações e segurança",
 },
 ];

 // Quick bottom bar items matching mobile model
 const bottomBarItems = [
 { id:"dashboard"as AdminTab, label:"Hoje", icon: TrendingUp },
 { id:"agenda"as AdminTab, label:"Agenda", icon: Calendar },
 { id:"queue"as AdminTab, label:"Espera", icon: Clock },
 ];

 // Agrupamento puramente visual da navegação: reduz uma lista plana de 12 itens
 // a 4 blocos com propósito claro. Não altera AdminTab, rotas ou persistência de aba.
 const navGroups: { label: string; tabs: AdminTab[] }[] = [
  { label: "Operação", tabs: ["dashboard", "agenda", "queue", "atendimento"] },
  {
    label: "Clientes & CRM",
    tabs: [
      "clientes",
      "relacionamento_overview",
      "relacionamento_followup",
      "relacionamento_reviews",
      "relacionamento_birthdays",
      "lembretes",
    ],
  },
  {
    label: "Financeiro",
    tabs: [
      "financeiro_recebimentos",
      "financeiro_extrato",
      "financeiro_saidas",
    ],
  },
  {
    label: "Gestão",
    tabs: ["relatorios", "catalogo"],
  },
  {
    label: "Marketing & Retenção",
    tabs: ["campanhas", "fidelidade", "premios", "assinaturas", "indicacoes"],
  },
  { label: "Configuração", tabs: ["sistema"] },
];

 const renderSidebarNavigation = (mobile = false) => (
 <nav
 data-admin-sidebar-navigation={mobile ?"mobile":"desktop"}
 className={
 mobile
 ?"flex-1 px-3 py-4 overflow-y-auto custom-scrollbar"
 :"flex-1 px-2 py-4 overflow-y-auto no-scrollbar"
 }
 >
 {navGroups.map((group, groupIndex) => (
 <div key={group.label} className={groupIndex > 0 ?"mt-4":""}>
 <p
 className={`px-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-sidebar-text-muted)] ${mobile ?"px-3":""}`}
 >
 {group.label}
 </p>
 <div className="admin-sidebar-items space-y-0.5">
 {navItems
 .filter((item) => group.tabs.includes(item.id))
 .map((item) => {
 const Icon = item.icon;
 const isActive = activeTab === item.id;
 return (
 <button
 key={item.id}
 type="button"
 onClick={() => handleSidebarTabChange(item.id, mobile)}
 data-admin-sidebar-item={item.id}
 title={item.description}
 className={`admin-nav-item w-full ${mobile ?"min-h-[44px]":"min-h-[36px]"} ${isActive ?"active":""}`}
 aria-current={isActive ?"page": undefined}
 >
 <Icon
 className={`${mobile ?"w-[18px] h-[18px]":"w-4 h-4"} shrink-0`}
 />
 <span className="flex-1 text-left truncate min-w-0">
 {item.label}
 </span>
 {isActive && <ChevronRight className="w-3 h-3 shrink-0"/>}
 </button>
 );
 })}
 </div>
 </div>
 ))}
 </nav>
 );

 const handleLogout = async () => {
 try {
 await authFetch("/api/auth/logout", { method:"POST"});
 } catch (e) {}
 try {
 window.sessionStorage.removeItem(ADMIN_ACTIVE_TAB_KEY);
 } catch {}
 setIsAuthorized(false);
 };

 const renderContent = () => {
 switch (activeTab) {
 case"dashboard":
 return (
 <NavoHomeView
 onNavigateToAgenda={() => setActiveTab("agenda")}
 onNavigateToQueue={() => setActiveTab("queue")}
 onNavigateToReceipts={() => setActiveTab("financeiro_recebimentos")}
 />
 );
 case"agenda":
 return <ScheduleGrid />;
 case"queue":
 return <WaitingQueue />;
 case"atendimento":
 return <WhatsAppInboxManagement />;
 case"relatorios":
 return <ReportsWorkspace />;
 case"campanhas":
 return (
 <CampaignsWorkspace
 initialProvider={campaignInitialProvider || undefined}
 onOpenMetaSettings={() => {
 setSystemInitialTab("meta_ads");
 setActiveTab("sistema");
 }}
 onOpenGoogleSettings={() => {
 setSystemInitialTab("google_ads");
 setActiveTab("sistema");
 }}
 />
 );
 case"financeiro_recebimentos":
 return <ReceiptsManagement />;
 case"financeiro_extrato":
 return <FinancialStatementManagement />;
 case"financeiro_saidas":
 return <ExpensesManagement />;
 case"clientes":
 return <ClientsManagement />;
 case"catalogo":
 return <CatalogWorkspace />;
 case"relacionamento_overview":
 return <NavoRewardsAdmin initialTab="dashboard"/>;
 case"relacionamento_reviews":
 return <NavoRewardsAdmin initialTab="reviews"/>;
 case"relacionamento_followup":
 return <FollowUpManagement />;
 case"relacionamento_birthdays":
 return <BirthdaysManagement />;
 case"fidelidade":
 return <NavoRewardsAdmin initialTab="loyalty"/>;
 case"premios":
 return <NavoRewardsAdmin initialTab="rewards"/>;
 case"assinaturas":
 return <SubscriptionsManagement />;
 case"indicacoes":
 return <NavoRewardsAdmin initialTab="referrals"/>;
 case"lembretes":
 return <AppointmentRemindersManagement />;
 case"sistema":
 return (
 <SystemWorkspace
 initialTab={systemInitialTab}
 onOpenCampaigns={(provider ="meta") => {
 setCampaignInitialProvider(provider);
 setActiveTab("campanhas");
 }}
 />
 );
 default:
 return null;
 }
 };

 const isMoreActive = !bottomBarItems.some((item) => item.id === activeTab);

 return (
 <div className="admin-shell h-[100dvh] bg-[var(--admin-bg)] flex text-[var(--admin-text-main)] font-sans antialiased overflow-hidden">
 {/* Desktop Sidebar (Fixed layout for screens >= 1024px) */}
 <aside className="hidden lg:flex admin-layout-sidebar lg:fixed lg:inset-y-0 lg:left-0 z-30">
 {/* Logo Header */}
 <div className="flex items-center h-[var(--admin-header-height)] px-4 border-b border-[var(--admin-sidebar-border)] shrink-0">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-8 h-8 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] rounded-[var(--admin-radius-md)] flex items-center justify-center shrink-0 font-bold">
 <Scissors className="w-4 h-4"/>
 </div>
 <h1 className="admin-title-h3 truncate">Navo Premium</h1>
 </div>
 </div>

 {/* Navigation */}
 {renderSidebarNavigation()}

 {/* User Profile Footer */}
 <div className="p-4 border-t border-[var(--admin-sidebar-border)] shrink-0 flex flex-col gap-3">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-[var(--admin-radius-md)] bg-[var(--admin-accent)] flex items-center justify-center text-[var(--admin-accent-text)] font-bold text-sm uppercase shrink-0">
 {adminName.substring(0, 2)}
 </div>
 <div className="flex-1 min-w-0">
 <p className="admin-text-body font-semibold truncate text-[var(--admin-sidebar-text)]">
 {adminName}
 </p>
 <p className="admin-label mt-0.5 text-[var(--admin-sidebar-text-muted)]">Administrador</p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={toggleTheme}
 className="flex-1 h-9 px-0 rounded-[var(--admin-radius-sm)] bg-white/5 border border-white/10 text-[var(--admin-sidebar-text)] hover:bg-white/10 hover:border-white/20 transition-colors flex items-center justify-center"
 title={theme ==="dark"?"Modo claro":"Modo escuro"}
 aria-label="Alternar tema"
 >
 {theme ==="dark"? (
 <Sun className="w-4 h-4 text-[var(--admin-accent)]"/>
 ) : (
 <Moon className="w-4 h-4 text-[var(--admin-sidebar-text-muted)]"/>
 )}
 </button>
 <div className="flex-1 flex justify-center">
 <AdminNotificationCenter
 notificationsSupported={notificationsSupported}
 notificationPermission={notificationPermission}
 notificationsActive={notificationsActive}
 notificationsBusy={notificationsBusy}
 onToggleNotifications={toggleNotifications}
 />
 </div>
 <button
 onClick={handleLogout}
 className="flex-1 h-9 px-0 rounded-[var(--admin-radius-sm)] bg-white/5 border border-white/10 text-status-error hover:bg-status-error/15 hover:border-status-error/30 transition-colors flex items-center justify-center"
 title="Sair"
 aria-label="Sair"
 >
 <LogOut className="w-4 h-4 mx-auto"/>
 </button>
 </div>
 </div>
 </aside>

 {/* Mobile Topbar */}
 <header className="admin-mobile-topbar lg:hidden fixed top-0 left-0 right-0 bg-[var(--admin-sidebar-bg)] text-[var(--admin-sidebar-text)] border-b border-[var(--admin-sidebar-border)] z-40 px-3 flex items-center justify-between h-[var(--admin-header-height)]">
 <div className="flex items-center gap-3 min-w-0 px-1">
 <div className="w-8 h-8 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] rounded-[var(--admin-radius-sm)] flex items-center justify-center shrink-0">
 <Scissors className="w-4 h-4"/>
 </div>
 <h1 className="admin-title-h3 truncate">
 {navItems.find((i) => i.id === activeTab)?.label ||"Navo Premium"}
 </h1>
 </div>

 <div className="flex items-center gap-1.5 shrink-0">
 <AdminNotificationCenter
 notificationsSupported={notificationsSupported}
 notificationPermission={notificationPermission}
 notificationsActive={notificationsActive}
 notificationsBusy={notificationsBusy}
 onToggleNotifications={toggleNotifications}
 />
 <button
 type="button"
 onClick={toggleTheme}
 className="admin-btn-icon admin-btn-ghost rounded-[var(--admin-radius-full)]"
 title={theme ==="dark"?"Modo claro":"Modo escuro"}
 aria-label={
 theme ==="dark"?"Ativar modo claro":"Ativar modo escuro"
 }
 >
 {theme ==="dark"? (
 <Sun className="w-5 h-5 text-[var(--admin-accent)]"/>
 ) : (
 <Moon className="w-5 h-5"/>
 )}
 </button>
 <button
 type="button"
 onClick={openMobileNavigation}
 className="admin-btn-icon admin-btn-ghost rounded-[var(--admin-radius-full)]"
 aria-label="Abrir Menu de Navegação"
 >
 <Menu className="w-5 h-5"/>
 </button>
 </div>
 </header>

 {/* Mobile Bottom Navigation Bar */}
 <nav className="admin-mobile-bottom-bar lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--admin-sidebar-bg)] text-[var(--admin-sidebar-text)] border-t border-[var(--admin-sidebar-border)] z-40 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
 {bottomBarItems.map((item) => {
 const Icon = item.icon;
 const isActive = activeTab === item.id;
 return (
 <button
 key={item.id}
 type="button"
 onClick={() => handleSidebarTabChange(item.id, true)}
 aria-current={isActive ?"page": undefined}
 className={`flex-1 min-h-[64px] flex flex-col items-center justify-center gap-1 rounded-[var(--admin-radius-md)] my-1 mx-0.5 transition-colors active:scale-[0.97] ${
 isActive
 ?"text-[var(--admin-accent)] font-semibold bg-[var(--admin-accent)]/10"
 :"text-[var(--admin-sidebar-text-muted)] hover:text-[var(--admin-sidebar-text)] hover:bg-white/5"
 }`}
 >
 <Icon className="w-5 h-5 shrink-0"/>
 <span className="text-[10px] font-medium tracking-tight max-w-[76px] truncate">
 {item.label}
 </span>
 </button>
 );
 })}

 {/* 4th Item: Menu / Mais */}
 <button
 type="button"
 onClick={openMobileNavigation}
 className={`flex-1 min-h-[64px] flex flex-col items-center justify-center gap-1 rounded-[var(--admin-radius-md)] my-1 mx-0.5 transition-colors active:scale-[0.97] ${
 isMoreActive
 ?"text-[var(--admin-accent)] font-semibold bg-[var(--admin-accent)]/10"
 :"text-[var(--admin-sidebar-text-muted)] hover:text-[var(--admin-sidebar-text)] hover:bg-white/5"
 }`}
 >
 <MoreHorizontal className="w-5 h-5 shrink-0"/>
 <span className="text-[10px] font-medium tracking-tight max-w-[76px] truncate">
 Mais
 </span>
 </button>
 </nav>

 {/* Mobile Drawer (Side sheet) */}
 <div
 className={`admin-mobile-drawer lg:hidden fixed inset-0 z-50 flex justify-start ${sidebarOpen ?"pointer-events-auto":"pointer-events-none"}`}
 aria-hidden={!sidebarOpen}
 inert={!sidebarOpen}
 >
 <div
 className={`fixed inset-0 bg-black/55 transition-opacity duration-200 ${sidebarOpen ?"opacity-100":"opacity-0"}`}
 onClick={closeMobileNavigation}
 aria-hidden="true"
 />

 <aside
 ref={sidebarRef}
 tabIndex={-1}
 className={`relative w-[min(280px,84vw)] bg-[var(--admin-sidebar-bg)] text-[var(--admin-sidebar-text)] flex flex-col border-r border-[var(--admin-sidebar-border)] h-[100dvh] outline-none transform transition-transform duration-200 ease-out ${sidebarOpen ?"translate-x-0":"-translate-x-full"}`}
 >
 {/* Header */}
 <div className="flex items-center justify-between min-h-[var(--admin-header-height)] px-4 pt-[env(safe-area-inset-top)] border-b border-[var(--admin-sidebar-border)] shrink-0">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-8 h-8 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] rounded-[var(--admin-radius-sm)] flex items-center justify-center shrink-0 font-bold">
 <Scissors className="w-4 h-4"/>
 </div>
 <h1 className="admin-title-h3 truncate">Navo Premium</h1>
 </div>
 <button
 type="button"
 onClick={closeMobileNavigation}
 className="admin-btn-icon-sm rounded-[var(--admin-radius-sm)] text-[var(--admin-sidebar-text-muted)] hover:text-[var(--admin-sidebar-text)] hover:bg-white/5"
 aria-label="Fechar menu"
 >
 <X className="w-5 h-5"/>
 </button>
 </div>

 {/* Navigation */}
 {renderSidebarNavigation(true)}

 {/* Mobile Footer */}
 <div className="p-4 border-t border-[var(--admin-sidebar-border)] shrink-0 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={toggleTheme}
 className="flex-1 h-10 px-0 rounded-[var(--admin-radius-sm)] bg-white/5 border border-white/10 text-[var(--admin-sidebar-text)] hover:bg-white/10 hover:border-white/20 transition-colors flex items-center justify-center"
 title={theme ==="dark"?"Modo claro":"Modo escuro"}
 aria-label={
 theme ==="dark"?"Ativar modo claro":"Ativar modo escuro"
 }
 >
 {theme ==="dark"? (
 <Sun className="w-4 h-4 text-[var(--admin-accent)]"/>
 ) : (
 <Moon className="w-4 h-4 text-[var(--admin-sidebar-text-muted)]"/>
 )}
 </button>
 <button
 type="button"
 onClick={handleLogout}
 className="flex-[2] h-10 rounded-[var(--admin-radius-sm)] bg-white/5 border border-white/10 text-status-error hover:bg-status-error/15 hover:border-status-error/30 transition-colors flex items-center justify-center gap-2"
 >
 <LogOut className="w-4 h-4 shrink-0"/>
 <span className="admin-button-label text-sm font-semibold">Sair</span>
 </button>
 </div>
 </div>
 </aside>
 </div>

 {/* Main Content Area */}
 <main
 ref={mainRef}
 className="admin-layout-main lg:ml-[var(--admin-sidebar-width)] pt-[calc(var(--admin-header-height)+env(safe-area-inset-top))] lg:pt-0 h-[100dvh] overflow-y-auto no-scrollbar relative w-full"
 tabIndex={-1}
 onTouchStart={pullToRefreshHandlers.onTouchStart}
 onTouchMove={pullToRefreshHandlers.onTouchMove}
 onTouchEnd={pullToRefreshHandlers.onTouchEnd}
 >
 <PullToRefreshIndicator
 pullDistance={pullDistance}
 isRefreshing={isRefreshing}
 />
 <div className="admin-content-wrapper">
 {/* Tab Content */}
 <div
 key={activeTab}
 className="admin-content-transition w-full min-w-0"
 >
 {renderContent()}
 </div>
 </div>
 </main>
 </div>
 );
};
