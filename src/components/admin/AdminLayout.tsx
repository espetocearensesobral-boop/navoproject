import React, { useState, useRef } from 'react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../shared/PullToRefreshIndicator';
import { NavoHomeView } from './NavoHomeView';
import { ScheduleGrid } from './ScheduleGrid';
import { ReceiptsManagement } from './ReceiptsManagement';
import { FinancialStatementManagement } from './FinancialStatementManagement';
import { ExpensesManagement } from './ExpensesManagement';
import { ClientsManagement } from './ClientsManagement';
import { WaitingQueue } from './WaitingQueue';
import { AdminAuthView } from './AdminAuthView';
import { CatalogWorkspace } from './CatalogWorkspace';
import { ReportsWorkspace } from './ReportsWorkspace';
import { RelationshipWorkspace } from './RelationshipWorkspace';
import { SystemWorkspace } from './SystemWorkspace';
import { AdminNotificationCenter } from './AdminNotificationCenter';
import { authFetch } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useAdminOperationNotifications } from '../../hooks/useAdminOperationNotifications';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { hapticLight } from '../../lib/haptics';
import {
  Calendar,
  Clock,
  UserCheck,
  Menu,
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
  Scissors,
  MoreHorizontal,
  Store,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';

export type AdminTab =
  | 'dashboard'
  | 'agenda'
  | 'queue'
  | 'relatorios'
  | 'financeiro_recebimentos'
  | 'financeiro_extrato'
  | 'financeiro_saidas'
  | 'clientes'
  | 'catalogo'
  | 'relacionamento'
  | 'sistema';


const ADMIN_ACTIVE_TAB_KEY = 'navo-admin-active-tab';
const ADMIN_TAB_VALUES: AdminTab[] = [
  'dashboard', 'agenda', 'queue', 'relatorios', 'financeiro_recebimentos', 'financeiro_extrato', 'financeiro_saidas',
  'clientes', 'catalogo', 'relacionamento', 'sistema'
];

const getStoredAdminTab = (): AdminTab => {
  if (typeof window === 'undefined') return 'dashboard';
  try {
    const storedTab = window.sessionStorage.getItem(ADMIN_ACTIVE_TAB_KEY);
    const legacyTabMap: Record<string, AdminTab> = {
      financeiro: 'financeiro_recebimentos',
      financeiro_relatorios: 'relatorios',
      rewards: 'relacionamento',
      servicos: 'catalogo',
      profissionais: 'catalogo',
      produtos: 'catalogo',
      relacionamento_dashboard: 'relacionamento',
      relacionamento_loyalty: 'relacionamento',
      relacionamento_rewards: 'relacionamento',
      relacionamento_referrals: 'relacionamento',
      relacionamento_reviews: 'relacionamento',
      followup: 'relacionamento',
      aniversariantes: 'relacionamento',
      barbearia: 'sistema',
      settings: 'sistema',
      settings_agenda: 'sistema',
      settings_print: 'sistema',
      audit: 'sistema',
      whatsapp: 'sistema',
      qrcode: 'sistema',
    };
    const normalizedTab = (storedTab && legacyTabMap[storedTab]) || storedTab;
    return normalizedTab && ADMIN_TAB_VALUES.includes(normalizedTab as AdminTab)
      ? normalizedTab as AdminTab
      : 'dashboard';
  } catch {
    return 'dashboard';
  }
};


export const AdminLayout: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { isSupported: notificationsSupported, permission: notificationPermission, toggleNotifications, backgroundPushEnabled, notificationsBusy } = useAdminOperationNotifications(isAuthorized);
  const [activeTab, setActiveTab] = useState<AdminTab>(() => getStoredAdminTab());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [adminName, setAdminName] = useState('Admin');

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
  const notificationsActive = notificationsSupported && notificationPermission === 'granted' && backgroundPushEnabled;

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
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
        mobile ? '[data-admin-sidebar-navigation="mobile"]' : '[data-admin-sidebar-navigation="desktop"]'
      );
      const target = navigation?.querySelector<HTMLElement>(`[data-admin-sidebar-item="${tab}"]`);
      if (!navigation || !target) return;

      const navigationRect = navigation.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetTop = navigation.scrollTop + (targetRect.top - navigationRect.top) - ((navigation.clientHeight - targetRect.height) / 2);

      navigation.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      });
    });
  };


  const handleSidebarTabChange = (tab: AdminTab, mobile = false) => {
    setActiveTab(tab);
    if (mobile) {
      hapticLight();
      setSidebarOpen(false);
      return;
    }
    scrollSidebarNavigationToItem(tab);
  };

  const { pullDistance, isRefreshing, handlers: pullToRefreshHandlers } = usePullToRefresh(
    mainRef,
    {
      onRefresh: async () => {
        window.dispatchEvent(new CustomEvent('adminRefresh'));
        await new Promise(resolve => setTimeout(resolve, 800)); // wait a bit for data to load
      }
    }
  );

  // Padroniza o foco inicial de todos os modais do Admin sem exigir refs em cada tela.
  React.useEffect(() => {
    const focusFirstModalField = () => {
      const modal = document.querySelector<HTMLElement>('.admin-shell .fixed.inset-0 form, .admin-shell .fixed.inset-0 [role="dialog"], .admin-shell .fixed.inset-0 .admin-modal');
      if (!modal || modal.contains(document.activeElement)) return;
      const firstField = modal.querySelector<HTMLElement>('[data-autofocus], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button[type="submit"]:not([disabled])');
      firstField?.focus();
    };

    const observer = new MutationObserver(() => window.requestAnimationFrame(focusFirstModalField));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // A autorização vem exclusivamente da sessão HTTP e do perfil no banco.
  React.useEffect(() => {
    setIsLoadingAuth(true);
    authFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('Sessão inválida');
        return res.json();
      })
      .then((user) => {
        if (user?.role !== 'admin') throw new Error('Acesso restrito');
        setIsAuthorized(true);
        setAdminName(user.name || 'Admin');
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
      <div className="flex h-[100dvh] items-center justify-center bg-surface-base">
        <div className="w-8 h-8 border-4 border-gold-base/20 border-t-gold-base rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <AdminAuthView 
        onLoginSuccess={(user) => {
          setIsAuthorized(true);
          setAdminName(user.name || 'Admin');
        }} 
      />
    );
  }

  const navItems = [
    {
      id: 'dashboard' as AdminTab,
      label: 'Hoje',
      icon: TrendingUp,
      description: 'Resumo e alertas do dia',
    },
    {
      id: 'agenda' as AdminTab,
      label: 'Agenda',
      icon: Calendar,
      description: 'Horários, encaixes e bloqueios',
    },
    {
      id: 'queue' as AdminTab,
      label: 'Fila',
      icon: Clock,
      description: 'Atendimentos em andamento',
    },
    {
      id: 'relatorios' as AdminTab,
      label: 'Relatórios',
      icon: FileText,
      description: 'Operação e financeiro',
    },
    {
      id: 'financeiro_recebimentos' as AdminTab,
      label: 'Recebimentos',
      icon: Wallet,
      description: 'Pendências e recebimentos confirmados',
    },
    {
      id: 'financeiro_extrato' as AdminTab,
      label: 'Extrato',
      icon: DollarSign,
      description: 'Livro-caixa persistido',
    },
    {
      id: 'financeiro_saidas' as AdminTab,
      label: 'Saídas',
      icon: ArrowDownRight,
      description: 'Despesas e pagamentos',
    },
    {
      id: 'clientes' as AdminTab,
      label: 'Clientes',
      icon: UserCheck,
      description: 'Base de clientes',
    },
    {
      id: 'catalogo' as AdminTab,
      label: 'Catálogo',
      icon: Package,
      description: 'Serviços, equipe e estoque',
    },
    {
      id: 'relacionamento' as AdminTab,
      label: 'Relacionamento',
      icon: Award,
      description: 'Fidelidade, avaliações e retorno',
    },
    {
      id: 'sistema' as AdminTab,
      label: 'Sistema',
      icon: Settings,
      description: 'Unidade, integrações e segurança',
    },
  ];


  // Quick bottom bar items matching mobile model
  const bottomBarItems = [
    { id: 'dashboard' as AdminTab, label: 'Hoje', icon: TrendingUp },
    { id: 'agenda' as AdminTab, label: 'Agenda', icon: Calendar },
    { id: 'queue' as AdminTab, label: 'Espera', icon: Clock },
  ];

  const renderSidebarNavigation = (mobile = false) => (
    <nav
      data-admin-sidebar-navigation={mobile ? 'mobile' : 'desktop'}
      className={mobile ? 'flex-1 px-3 py-4 overflow-y-auto custom-scrollbar' : 'flex-1 px-2 py-4 overflow-y-auto no-scrollbar'}
    >
      <div className="admin-sidebar-items space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSidebarTabChange(item.id, mobile)}
              data-admin-sidebar-item={item.id}
              title={item.description}
              className={`admin-sidebar-item w-full ${mobile ? 'min-h-11 px-3 rounded-lg text-sm gap-3' : 'min-h-9 px-2 rounded-md text-xs gap-2'} font-medium flex items-center transition-colors group min-w-0 ${isActive ? 'admin-sidebar-item-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`${mobile ? 'w-[18px] h-[18px]' : 'w-4 h-4'} shrink-0`} />
              <span className="flex-1 text-left truncate min-w-0">{item.label}</span>
              {isActive && <ChevronRight className="admin-sidebar-item-chevron w-3 h-3 shrink-0" />}
            </button>
          );
        })}
      </div>
    </nav>
  );

  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    try {
      window.sessionStorage.removeItem(ADMIN_ACTIVE_TAB_KEY);
    } catch {}
    setIsAuthorized(false);
  };

  

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <NavoHomeView onNavigateToAgenda={() => setActiveTab('agenda')} />;
      case 'agenda':
        return <ScheduleGrid />;
      case 'queue':
        return <WaitingQueue />;
      case 'relatorios':
        return <ReportsWorkspace />;
      case 'financeiro_recebimentos':
        return <ReceiptsManagement />;
      case 'financeiro_extrato':
        return <FinancialStatementManagement />;
      case 'financeiro_saidas':
        return <ExpensesManagement />;
      case 'clientes':
        return <ClientsManagement />;
      case 'catalogo':
        return <CatalogWorkspace />;
      case 'relacionamento':
        return <RelationshipWorkspace />;
      case 'sistema':
        return <SystemWorkspace />;
      default:
        return null;
    }
  };

  const isMoreActive = !bottomBarItems.some(item => item.id === activeTab);

  return (
    <div className="admin-shell h-[100dvh] bg-surface-base flex text-content-base font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar (Fixed layout for screens >= 1024px) */}
      <aside className="hidden lg:flex lg:w-56 lg:flex-col shrink-0 lg:bg-surface-card lg:border-r lg:border-border-subtle lg:fixed lg:inset-y-0 lg:left-0 text-content-base z-30">
        {/* Logo Header (Fixed 56px height) */}
        <div className="flex items-center h-12 px-3 border-b border-border-subtle shrink-0 bg-surface-card">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 bg-gold-base text-content-on-accent rounded-md flex items-center justify-center shrink-0 font-bold">
              <Scissors className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-xs font-semibold text-content-base tracking-tight truncate">Navo Premium</h1>
          </div>
        </div>

        {/* Navigation */}
        {renderSidebarNavigation()}

        {/* User Profile Footer */}
        <div className="p-2 border-t border-border-subtle shrink-0 bg-surface-card">
          <div className="flex items-center gap-2 px-2 h-10 rounded-md bg-surface-base border border-border-subtle">
            <div className="w-6 h-6 rounded-md bg-gold-base flex items-center justify-center text-content-on-accent font-bold text-[10px] uppercase shrink-0">
              {adminName.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-content-base truncate">{adminName}</p>
              <p className="text-[9px] font-medium text-content-muted uppercase tracking-wider">Admin</p>
            </div>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-base text-content-muted hover:text-gold-base active:bg-surface-elevated transition-colors shrink-0"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-gold-base" /> : <Moon className="w-4 h-4 text-content-muted" />}
            </button>
            <AdminNotificationCenter
              notificationsSupported={notificationsSupported}
              notificationPermission={notificationPermission}
              notificationsActive={notificationsActive}
              notificationsBusy={notificationsBusy}
              onToggleNotifications={toggleNotifications}
            />
            <button 
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors shrink-0"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Topbar */}
      <header className="admin-mobile-topbar lg:hidden fixed top-0 left-0 right-0 bg-surface-card border-b border-border-subtle z-40 px-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 px-2">
          <div className="w-7 h-7 bg-gold-base text-surface-base rounded-md flex items-center justify-center shrink-0">
            <Scissors className="w-4 h-4" />
          </div>
          <h1 className="text-sm font-serif font-bold text-content-base truncate">
            {navItems.find(i => i.id === activeTab)?.label || 'Navo Premium'}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            className="w-10 h-10 flex items-center justify-center rounded-full border border-border-subtle bg-surface-card text-content-muted hover:text-gold-base active:text-gold-base active:scale-[0.97] transition-[transform,color,background-color] duration-150"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-gold-base" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={openMobileNavigation}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-border-subtle bg-surface-card text-content-muted active:text-gold-base active:scale-[0.97] transition-[transform,color,background-color] duration-150"
            aria-label="Abrir Menu de Navegação"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="admin-mobile-bottom-bar lg:hidden fixed bottom-0 left-0 right-0 bg-surface-card border-t border-border-subtle z-40 flex items-center justify-around px-2">
        {bottomBarItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSidebarTabChange(item.id, true)}
              aria-current={isActive ? 'page' : undefined}
              className={`admin-bottom-nav-item flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 rounded-md transition-[transform,color,background-color] duration-150 active:scale-[0.97] ${
                isActive 
                  ? 'text-gold-base font-bold bg-gold-base/10' 
                  : 'text-content-muted hover:text-content-base'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="admin-button-label text-[11px] font-semibold tracking-tight max-w-[76px]">{item.label}</span>
            </button>
          );
        })}

        {/* 4th Item: Menu / Mais */}
        <button
                      type="button"
          onClick={openMobileNavigation}
          className={`admin-bottom-nav-item flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 rounded-md transition-[transform,color,background-color] duration-150 active:scale-[0.97] ${
            isMoreActive ? 'text-gold-base font-bold' : 'text-content-muted hover:text-content-base'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 shrink-0" />
          <span className="admin-button-label text-[11px] font-semibold tracking-tight max-w-[76px]">Mais</span>
        </button>
      </nav>

      {/* Mobile Drawer (Side sheet) */}
      <div
        className={`admin-mobile-drawer lg:hidden fixed inset-0 z-50 flex justify-start ${sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <div
          className={`fixed inset-0 bg-black/55 transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={closeMobileNavigation}
          aria-hidden="true"
        />

        <aside
          ref={sidebarRef}
          tabIndex={-1}
          className={`relative w-[min(280px,84vw)] bg-surface-card text-content-base flex flex-col border-r border-border-subtle h-[100dvh] outline-none transform transition-transform duration-200 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between min-h-14 px-4 pt-[env(safe-area-inset-top)] border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 bg-gold-base text-content-on-accent rounded-md flex items-center justify-center shrink-0 font-bold">
                <Scissors className="w-3.5 h-3.5" />
              </div>
              <h1 className="text-sm font-serif font-bold text-content-base truncate">Navo Premium</h1>
            </div>
            <button
              type="button"
              onClick={closeMobileNavigation}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-content-muted hover:text-content-base active:bg-surface-base active:scale-[0.97] transition-[transform,color,background-color] duration-150"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          {renderSidebarNavigation(true)}

          {/* Mobile Footer */}
          <div className="p-3 border-t border-border-subtle shrink-0 space-y-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <AdminNotificationCenter
              notificationsSupported={notificationsSupported}
              notificationPermission={notificationPermission}
              notificationsActive={notificationsActive}
              notificationsBusy={notificationsBusy}
              onToggleNotifications={toggleNotifications}
              placement="drawer"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="h-11 w-11 flex items-center justify-center rounded-xl border border-border-subtle bg-surface-base text-content-muted hover:text-gold-base active:scale-[0.97] transition-[transform,color,background-color] duration-150 shrink-0"
                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-gold-base" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 h-11 flex items-center justify-center gap-2 px-3 rounded-xl bg-red-600 text-white hover:bg-red-700 active:bg-red-800 active:scale-[0.99] font-semibold text-xs transition-[transform,background-color] duration-150 min-w-0"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="admin-button-label">Sair</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 lg:ml-56 pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-0 h-[100dvh] overflow-y-auto no-scrollbar relative w-full" tabIndex={-1} onTouchStart={pullToRefreshHandlers.onTouchStart} onTouchMove={pullToRefreshHandlers.onTouchMove} onTouchEnd={pullToRefreshHandlers.onTouchEnd}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
        <div className="max-w-[1320px] mx-auto px-3 sm:px-5 lg:px-6 py-5 lg:pt-6 lg:pb-10 pb-[calc(6rem+env(safe-area-inset-bottom))] w-full min-w-0">
          {/* Tab Content */}
          <div key={activeTab} className="admin-content-transition w-full min-w-0">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};


