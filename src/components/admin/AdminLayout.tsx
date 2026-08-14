import React, { useState, useRef } from 'react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../shared/PullToRefreshIndicator';
import { NavoHomeView } from './NavoHomeView';
import { ScheduleGrid } from './ScheduleGrid';
import { FinanceiroManagement } from './FinanceiroManagement';
import { AuditLogsManagement } from './AuditLogsManagement';
import { WhatsAppManagement } from './WhatsAppManagement';
import { QrCodeManagement } from './QrCodeManagement';
import { ServicesManagement } from './ServicesManagement';
import { ProductsManagement } from './ProductsManagement';
import { ProfessionalsManagement } from './ProfessionalsManagement';
import { ClientsManagement } from './ClientsManagement';
import { WaitingQueue } from './WaitingQueue';
import { SettingsManagement } from './SettingsManagement';
import { NavoRewardsAdmin } from './NavoRewardsAdmin';
import { BarbershopProfileManagement } from './BarbershopProfileManagement';
import { AdminAuthView } from './AdminAuthView';
import { authFetch, setStoredToken, clearStoredToken } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  Calendar,
  Clock,
  Scissors,
  Users,
  UserCheck,
  Settings,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  LogOut,
  Receipt,
  Award,
  Store,
  MoreHorizontal,
  LayoutGrid,
  FileText,
  Package,
  Wallet,
  ShieldCheck,
  MessageSquare,
  QrCode,
  Sun,
  Moon
} from 'lucide-react';

export type AdminTab = 
  | 'dashboard' 
  | 'agenda' 
  | 'financeiro'
  | 'audit'
  | 'whatsapp'
  | 'qrcode'
  | 'queue' 
  | 'rewards'
  | 'servicos'
  | 'produtos'
  | 'profissionais' 
  | 'clientes' 
  | 'barbearia'
  | 'settings';

export type AdminSection = 'operacao' | 'financeiro' | 'cadastros' | 'relacionamento' | 'sistema';

const ADMIN_ACTIVE_TAB_KEY = 'navo-admin-active-tab';
const ADMIN_TAB_VALUES: AdminTab[] = [
  'dashboard', 'agenda', 'financeiro', 'audit', 'whatsapp', 'qrcode', 'queue',
  'rewards', 'servicos', 'produtos', 'profissionais', 'clientes', 'barbearia', 'settings'
];

const getStoredAdminTab = (): AdminTab => {
  if (typeof window === 'undefined') return 'dashboard';
  try {
    const storedTab = window.sessionStorage.getItem(ADMIN_ACTIVE_TAB_KEY);
    return storedTab && ADMIN_TAB_VALUES.includes(storedTab as AdminTab)
      ? storedTab as AdminTab
      : 'dashboard';
  } catch {
    return 'dashboard';
  }
};

const ADMIN_TAB_SECTIONS: Partial<Record<AdminTab, AdminSection>> = {
  dashboard: 'operacao',
  agenda: 'operacao',
  queue: 'operacao',
  financeiro: 'financeiro',
  servicos: 'cadastros',
  produtos: 'cadastros',
  profissionais: 'cadastros',
  clientes: 'cadastros',
  rewards: 'relacionamento',
  barbearia: 'sistema',
  settings: 'sistema',
  audit: 'sistema',
  whatsapp: 'sistema',
  qrcode: 'sistema',
};

const getInitialCollapsedSections = (activeTab: AdminTab): Record<AdminSection, boolean> => {
  const activeSection = ADMIN_TAB_SECTIONS[activeTab];
  return {
    operacao: activeSection !== 'operacao',
    financeiro: activeSection !== 'financeiro',
    cadastros: activeSection !== 'cadastros',
    relacionamento: activeSection !== 'relacionamento',
    sistema: activeSection !== 'sistema',
  };
};

export const AdminLayout: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => getStoredAdminTab());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [adminName, setAdminName] = useState('Admin');
  const [collapsedSections, setCollapsedSections] = useState<Record<AdminSection, boolean>>(() => (
    getInitialCollapsedSections(getStoredAdminTab())
  ));

  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(ADMIN_ACTIVE_TAB_KEY, activeTab);
    } catch {
      // A navegação válida não deve falhar se o armazenamento estiver indisponível.
    }
  }, [activeTab]);

  const mainRef = useRef<HTMLElement>(null);
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
          if (user?.token) {
            setStoredToken(user.token);
          }
          setIsAuthorized(true);
          setAdminName(user.name || 'Admin');
        }} 
      />
    );
  }

  const navItems = [
    { 
      id: 'dashboard' as AdminTab, 
      label: 'Dashboard', 
      icon: TrendingUp,
      description: 'Métricas e análises',
      section: 'operacao' as AdminSection,
    },
    { 
      id: 'agenda' as AdminTab, 
      label: 'Agenda', 
      icon: Calendar,
      description: 'Gerenciar horários',
      section: 'operacao' as AdminSection,
    },
    { 
      id: 'queue' as AdminTab, 
      label: 'Fila de Espera', 
      icon: Clock,
      description: 'Clientes aguardando',
      section: 'operacao' as AdminSection,
    },
    { 
      id: 'financeiro' as AdminTab, 
      label: 'Financeiro', 
      icon: Wallet,
      description: 'PDV, extrato real e controles financeiros',
      section: 'financeiro' as AdminSection,
    },
    { 
      id: 'servicos' as AdminTab, 
      label: 'Serviços', 
      icon: Scissors,
      description: 'Catálogo de serviços',
      section: 'cadastros' as AdminSection,
    },
    {
      id: 'produtos' as AdminTab,
      label: 'Produtos & Estoque',
      icon: Package,
      description: 'Catálogo do PDV e alertas',
      section: 'cadastros' as AdminSection,
    },
    { 
      id: 'profissionais' as AdminTab, 
      label: 'Profissionais', 
      icon: Users,
      description: 'Equipe de barbeiros',
      section: 'cadastros' as AdminSection,
    },
    { 
      id: 'clientes' as AdminTab, 
      label: 'Clientes', 
      icon: UserCheck,
      description: 'Base de clientes',
      section: 'cadastros' as AdminSection,
    },
    { 
      id: 'rewards' as AdminTab, 
      label: 'Rewards & NPS', 
      icon: Award,
      description: 'Fidelidade e indicações',
      section: 'relacionamento' as AdminSection,
    },
    { 
      id: 'barbearia' as AdminTab, 
      label: 'Perfil & Unidade', 
      icon: Store,
      description: 'Endereço, horários e dados',
      section: 'sistema' as AdminSection,
    },
    { 
      id: 'settings' as AdminTab, 
      label: 'Configurações', 
      icon: Settings,
      description: 'Preferências do sistema',
      section: 'sistema' as AdminSection,
    },
  ];

  const sectionLabels: Record<AdminSection, string> = {
    operacao: 'Operação do Dia',
    financeiro: 'Financeiro',
    cadastros: 'Cadastros',
    relacionamento: 'Relacionamento',
    sistema: 'Sistema',
  };

  const sectionOrder: AdminSection[] = ['operacao', 'financeiro', 'cadastros', 'relacionamento', 'sistema'];

  // Quick bottom bar items matching mobile model
  const bottomBarItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: TrendingUp },
    { id: 'agenda' as AdminTab, label: 'Agenda', icon: Calendar },
    { id: 'queue' as AdminTab, label: 'Fila', icon: Clock },
  ];

  const renderSidebarNavigation = (mobile = false) => (
    <nav className={mobile ? 'flex-1 px-4 py-6 space-y-4 overflow-y-auto custom-scrollbar' : 'flex-1 px-3 py-6 space-y-4 overflow-y-auto no-scrollbar'}>
      {sectionOrder.map((section) => {
        const itemsInSection = navItems.filter((item) => item.section === section);
        if (itemsInSection.length === 0) return null;
        const isCollapsed = collapsedSections[section];

        return (
          <div key={section} className="space-y-1.5">
            <button
              type="button"
              onClick={() => setCollapsedSections((current) => ({ ...current, [section]: !current[section] }))}
              aria-expanded={!isCollapsed}
              className="admin-sidebar-section-toggle w-full min-h-9 px-3 flex items-center justify-between gap-2 rounded-lg text-left transition-colors hover:bg-surface-base"
            >
              <span className="admin-sidebar-section-label text-[11px] font-bold uppercase tracking-[0.16em] truncate">
                {sectionLabels[section]}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            </button>

            {!isCollapsed && (
              <div className="space-y-1">
                {itemsInSection.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        if (mobile) setSidebarOpen(false);
                      }}
                      className={`admin-sidebar-item w-full min-h-11 px-3.5 rounded-lg text-sm font-semibold flex items-center gap-3 transition-colors group min-w-0 ${isActive ? 'admin-sidebar-item-active shadow-sm' : ''}`}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="flex-1 text-left truncate min-w-0">{item.label}</span>
                      {isActive && <ChevronRight className="admin-sidebar-item-chevron w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    clearStoredToken();
    try {
      window.sessionStorage.removeItem(ADMIN_ACTIVE_TAB_KEY);
    } catch {}
    setIsAuthorized(false);
  };

  

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <NavoHomeView onNavigateToAgenda={() => setActiveTab('agenda')} />;
      case 'financeiro':
        return <FinanceiroManagement />;
      case 'audit':
        return <SettingsManagement initialTab="audit" />;
      case 'whatsapp':
        return <SettingsManagement initialTab="whatsapp" />;
      case 'qrcode':
        return <SettingsManagement initialTab="qrcode" />;
      case 'agenda':
        return <ScheduleGrid />;
      case 'queue':
        return <WaitingQueue />;
      case 'rewards':
        return <NavoRewardsAdmin />;
      case 'servicos':
        return <ServicesManagement />;
      case 'produtos':
        return <ProductsManagement />;
      case 'profissionais':
        return <ProfessionalsManagement />;
      case 'clientes':
        return <ClientsManagement />;
      case 'barbearia':
        return <BarbershopProfileManagement />;
      case 'settings':
        return <SettingsManagement />;
      default:
        return null;
    }
  };

  const isMoreActive = !bottomBarItems.some(item => item.id === activeTab);

  return (
    <div className="admin-shell h-[100dvh] bg-surface-base flex text-content-base font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar (Fixed layout for screens >= 1024px) */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col shrink-0 lg:bg-surface-card lg:border-r lg:border-border-subtle lg:fixed lg:inset-y-0 lg:left-0 text-content-base z-30">
        {/* Logo Header (Fixed 56px height) */}
        <div className="flex items-center h-16 px-5 border-b border-border-subtle relative overflow-hidden shrink-0 bg-surface-card">
          <div className="absolute top-0 left-0 right-0 h-0.5 barber-pole-line" />
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-gold-base text-content-on-accent rounded-xl flex items-center justify-center shadow-sm shrink-0 font-bold">
              <Scissors className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-serif font-bold text-content-base tracking-tight truncate">Navo Premium</h1>
              <p className="text-[9px] text-gold-base font-bold uppercase tracking-widest truncate">Heritage Barber & Club</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        {renderSidebarNavigation()}

        {/* User Profile Footer */}
        <div className="p-4 border-t border-border-subtle shrink-0 bg-surface-card">
          <div className="flex items-center gap-3 px-3 h-14 rounded-lg bg-surface-base border border-border-subtle">
            <div className="w-7 h-7 rounded-xl bg-gold-base flex items-center justify-center text-content-on-accent font-bold text-xs uppercase shrink-0">
              {adminName.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-content-base truncate">{adminName}</p>
              <p className="text-[9px] font-bold text-content-muted uppercase tracking-wider">Admin</p>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-base text-content-muted hover:text-gold-base active:bg-surface-elevated transition-colors shrink-0"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-gold-base" /> : <Moon className="w-4 h-4 text-content-muted" />}
            </button>
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
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-surface-card border-b border-border-subtle z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 px-2">
          <div className="w-8 h-8 bg-gold-base text-surface-base rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <Scissors className="w-4 h-4" />
          </div>
          <h1 className="text-sm font-serif font-bold text-content-base truncate">
            {navItems.find(i => i.id === activeTab)?.label || 'Navo Premium'}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-border-subtle bg-surface-card text-gold-base active:scale-95 transition-transform"
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-border-subtle bg-surface-card text-content-muted active:text-gold-base active:scale-95 transition-transform"
            aria-label="Abrir Menu de Navegação"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 min-h-[72px] bg-surface-card/95 backdrop-blur-md border-t border-border-subtle z-40 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {bottomBarItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-1 rounded-lg transition-all active:scale-95 ${
                isActive 
                  ? 'text-gold-base font-bold bg-gold-base/10' 
                  : 'text-content-muted hover:text-content-base'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-xs font-semibold tracking-tight truncate max-w-[76px]">{item.label}</span>
            </button>
          );
        })}

        {/* 4th Item: Menu / Mais */}
        <button
          onClick={() => setSidebarOpen(true)}
          className={`flex-1 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-95 ${
            isMoreActive ? 'text-gold-base font-bold' : 'text-content-muted hover:text-content-base'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 shrink-0" />
          <span className="text-xs font-semibold tracking-tight truncate max-w-[76px]">Mais</span>
        </button>
      </nav>

      {/* Mobile Drawer (Side sheet) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-start">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          
          <aside className="relative w-[min(320px,88vw)] bg-surface-card text-content-base flex flex-col animate-slide-in shadow-2xl border-r border-border-subtle h-[100dvh]">
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-5 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 bg-gold-base text-content-on-accent rounded-xl flex items-center justify-center shrink-0 font-bold">
                  <Scissors className="w-3.5 h-3.5" />
                </div>
                <h1 className="text-sm font-serif font-bold text-content-base truncate">Navo Premium</h1>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-content-muted hover:text-content-base active:bg-surface-base"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            {renderSidebarNavigation(true)}
            
            {/* Mobile Footer */}
            <div className="p-4 border-t border-border-subtle shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                onClick={handleLogout}
                className="w-full h-11 flex items-center justify-center gap-2 px-3 rounded-xl bg-red-600 text-white hover:bg-red-700 active:bg-red-800 font-semibold text-xs transition-colors min-w-0"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="truncate">Sair do sistema</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 lg:ml-72 pt-16 lg:pt-0 h-[100dvh] overflow-y-auto no-scrollbar relative w-full" tabIndex={-1} onTouchStart={pullToRefreshHandlers.onTouchStart} onTouchMove={pullToRefreshHandlers.onTouchMove} onTouchEnd={pullToRefreshHandlers.onTouchEnd}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
        <div className="max-w-[1440px] mx-auto px-4 sm:px-7 lg:px-10 py-6 lg:pt-9 lg:pb-14 pb-36 w-full min-w-0">
          {/* Tab Content */}
          <div className="animate-fade-in w-full min-w-0">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};


