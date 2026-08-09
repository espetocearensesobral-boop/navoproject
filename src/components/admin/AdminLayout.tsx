import React, { useState } from 'react';
import { NavoHomeView } from './NavoHomeView';
import { ScheduleGrid } from './ScheduleGrid';
import { PdvInteligente } from './PdvInteligente';
import { ComandasManagement } from './ComandasManagement';
import { FinanceiroManagement } from './FinanceiroManagement';
import { AuditLogsManagement } from './AuditLogsManagement';
import { SubscriptionsManagement } from './SubscriptionsManagement';
import { WhatsAppManagement } from './WhatsAppManagement';
import { QrCodeManagement } from './QrCodeManagement';
import { ServicesManagement } from './ServicesManagement';
import { ProfessionalsManagement } from './ProfessionalsManagement';
import { ClientsManagement } from './ClientsManagement';
import { WaitingQueue } from './WaitingQueue';
import { SettingsManagement } from './SettingsManagement';
import { NavoRewardsAdmin } from './NavoRewardsAdmin';
import { BarbershopProfileManagement } from './BarbershopProfileManagement';
import { AdminMobileHub } from './AdminMobileHub';
import { authFetch } from '../../lib/api';
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
  TrendingUp,
  LogOut,
  Receipt,
  Award,
  Store,
  MoreHorizontal,
  LayoutGrid,
  FileText,
  Wallet,
  ShieldCheck,
  MessageSquare,
  QrCode
} from 'lucide-react';

export type AdminTab = 
  | 'hub'
  | 'dashboard' 
  | 'agenda' 
  | 'pdv'
  | 'comandas'
  | 'financeiro'
  | 'audit'
  | 'subscriptions'
  | 'whatsapp'
  | 'qrcode'
  | 'queue' 
  | 'rewards'
  | 'servicos' 
  | 'profissionais' 
  | 'clientes' 
  | 'barbearia'
  | 'settings';

export type AdminSection = 'operacao' | 'financeiro' | 'cadastros' | 'relacionamento' | 'sistema';

export const AdminLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return 'hub';
    }
    return 'agenda';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminName, setAdminName] = useState('Admin');

  // A autorização vem exclusivamente da sessão HTTP e do perfil no banco.
  React.useEffect(() => {
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
      .catch(() => { window.location.href = '/'; });
  }, []);

  if (!isAuthorized) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-surface-base">
        <div className="w-8 h-8 border-4 border-gold-base/20 border-t-gold-base rounded-full animate-spin" />
      </div>
    );
  }

  const navItems = [
    { 
      id: 'hub' as AdminTab, 
      label: 'Módulos / Hub', 
      icon: LayoutGrid,
      description: 'Painel principal de entrada',
      section: 'operacao' as AdminSection,
    },
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
      id: 'pdv' as AdminTab, 
      label: 'PDV Rápido', 
      icon: Receipt,
      description: 'Checkout instantâneo',
      section: 'operacao' as AdminSection,
    },
    { 
      id: 'comandas' as AdminTab, 
      label: 'Comandas', 
      icon: FileText,
      description: 'Fechamento de conta',
      section: 'operacao' as AdminSection,
    },
    { 
      id: 'financeiro' as AdminTab, 
      label: 'Financeiro', 
      icon: Wallet,
      description: 'Caixa, extrato, contas a pagar, saúde e relatórios',
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
      id: 'subscriptions' as AdminTab, 
      label: 'Assinaturas & Clube', 
      icon: Award,
      description: 'Planos e comissões de clube',
      section: 'relacionamento' as AdminSection,
    },
    { 
      id: 'rewards' as AdminTab, 
      label: 'Rewards & NPS', 
      icon: Award,
      description: 'Fidelidade e indicações',
      section: 'relacionamento' as AdminSection,
    },
    { 
      id: 'whatsapp' as AdminTab, 
      label: 'Painel WhatsApp', 
      icon: MessageSquare,
      description: 'Notificações e saldo',
      section: 'relacionamento' as AdminSection,
    },
    { 
      id: 'qrcode' as AdminTab, 
      label: 'QR Code & Balcão', 
      icon: QrCode,
      description: 'Totens de agendamento',
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
      id: 'audit' as AdminTab, 
      label: 'Logs & Auditoria', 
      icon: ShieldCheck,
      description: 'Rastreio de ações',
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
    { id: 'hub' as AdminTab, label: 'Módulos', icon: LayoutGrid },
    { id: 'agenda' as AdminTab, label: 'Agenda', icon: Calendar },
    { id: 'clientes' as AdminTab, label: 'Clientes', icon: UserCheck },
  ];

  const handleLogout = () => {
    window.location.href = '/';
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'hub':
        return (
          <AdminMobileHub 
            onSelectTab={(tab) => setActiveTab(tab)} 
            adminName={adminName} 
            onLogout={handleLogout} 
          />
        );
      case 'dashboard':
        return <NavoHomeView onNavigateToAgenda={() => setActiveTab('agenda')} />;
      case 'pdv':
        return <PdvInteligente />;
      case 'comandas':
        return <ComandasManagement />;
      case 'financeiro':
        return <FinanceiroManagement />;
      case 'audit':
        return <AuditLogsManagement />;
      case 'subscriptions':
        return <SubscriptionsManagement />;
      case 'whatsapp':
        return <WhatsAppManagement />;
      case 'qrcode':
        return <QrCodeManagement />;
      case 'agenda':
        return <ScheduleGrid />;
      case 'queue':
        return <WaitingQueue />;
      case 'rewards':
        return <NavoRewardsAdmin />;
      case 'servicos':
        return <ServicesManagement />;
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
    <div className="h-[100dvh] bg-surface-base flex text-content-base font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar (Fixed layout for screens >= 1024px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col shrink-0 lg:bg-surface-card lg:border-r lg:border-border-subtle lg:fixed lg:inset-y-0">
        {/* Logo Header (Fixed 56px height) */}
        <div className="flex items-center h-[56px] px-4 border-b border-border-subtle relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 right-0 h-0.5 barber-pole-line" />
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-gold-base text-surface-base rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <Scissors className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-serif font-bold text-content-base tracking-tight truncate">Navo Premium</h1>
              <p className="text-[9px] text-gold-base font-bold uppercase tracking-widest truncate">Heritage Barber & Club</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-4 space-y-4 overflow-y-auto no-scrollbar">
          {sectionOrder.map((section) => {
            const itemsInSection = navItems.filter((item) => item.section === section);
            if (itemsInSection.length === 0) return null;

            return (
              <div key={section} className="space-y-1">
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-content-muted/70">
                  {sectionLabels[section]}
                </p>
                {itemsInSection.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full h-10 px-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors group min-w-0 active:bg-surface-base ${
                        isActive
                          ? 'bg-gold-base/10 text-gold-base border border-gold-base/30'
                          : 'text-content-muted hover:text-content-base hover:bg-surface-base'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-gold-base' : 'text-content-muted group-hover:text-content-base'}`} />
                      <span className="flex-1 text-left truncate min-w-0">{item.label}</span>
                      {isActive && (
                        <ChevronRight className="w-3.5 h-3.5 text-gold-base shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-border-subtle shrink-0">
          <div className="flex items-center gap-2.5 px-3 h-12 rounded-xl bg-surface-base border border-border-subtle/80">
            <div className="w-7 h-7 rounded-xl bg-gold-base flex items-center justify-center text-surface-base font-bold text-xs uppercase shrink-0">
              {adminName.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-content-base truncate">{adminName}</p>
              <p className="text-[9px] font-bold text-content-muted uppercase tracking-wider">Admin</p>
            </div>
            <button 
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-card text-content-muted hover:text-gold-base active:bg-surface-card transition-colors shrink-0"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Topbar - Only shown when inside a specific module (not on Hub) */}
      {activeTab !== 'hub' && (
        <header className="lg:hidden fixed top-0 left-0 right-0 h-[56px] bg-surface-card border-b border-border-subtle z-40 px-3 flex items-center justify-between">
          <button
            onClick={() => setActiveTab('hub')}
            className="h-9 px-2.5 flex items-center gap-1.5 rounded-lg border border-gold-base/30 bg-gold-base/10 text-gold-base text-xs font-bold active:scale-95 transition-all"
            aria-label="Voltar para Módulos"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Módulos</span>
          </button>
          
          <div className="flex items-center gap-2 min-w-0 px-2">
            <h1 className="text-sm font-serif font-bold text-content-base truncate">
              {navItems.find(i => i.id === activeTab)?.label || 'Navo Premium'}
            </h1>
          </div>

          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-subtle text-content-muted active:text-gold-base active:bg-surface-base"
            aria-label="Abrir Menu de Navegação"
          >
            <Menu className="w-4 h-4" />
          </button>
        </header>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[64px] bg-surface-card/95 backdrop-blur-md border-t border-border-subtle z-40 flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {bottomBarItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-95 ${
                isActive 
                  ? 'text-gold-base font-bold bg-gold-base/10' 
                  : 'text-content-muted hover:text-content-base'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] tracking-tight truncate max-w-[64px]">{item.label}</span>
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
          <span className="text-[10px] tracking-tight truncate max-w-[64px]">Mais</span>
        </button>
      </nav>

      {/* Mobile Drawer (Side sheet) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          
          <aside className="relative w-[280px] max-w-[80vw] bg-surface-card flex flex-col animate-slide-in shadow-2xl border-r border-border-subtle h-[100dvh]">
            {/* Header */}
            <div className="flex items-center justify-between h-[56px] px-4 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 bg-gold-base rounded-xl flex items-center justify-center text-surface-base shrink-0">
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
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto custom-scrollbar">
              {sectionOrder.map((section) => {
                const itemsInSection = navItems.filter((item) => item.section === section);
                if (itemsInSection.length === 0) return null;

                return (
                  <div key={section} className="space-y-1">
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-content-muted/70">
                      {sectionLabels[section]}
                    </p>
                    {itemsInSection.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setSidebarOpen(false);
                          }}
                          className={`w-full h-11 px-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors active:bg-surface-base ${
                            isActive
                              ? 'bg-gold-base/10 text-gold-base border border-gold-base/30'
                              : 'text-content-muted hover:text-content-base hover:bg-surface-base'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-gold-base' : 'text-content-muted'}`} />
                          <span className="truncate flex-1 text-left min-w-0">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
            
            {/* Mobile Footer */}
            <div className="p-3 border-t border-border-subtle shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button 
                onClick={handleLogout}
                className="w-full h-11 flex items-center justify-center gap-2 px-3 rounded-xl bg-surface-base text-content-muted hover:text-status-error border border-border-subtle font-semibold text-xs active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair do sistema</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 lg:ml-64 ${activeTab === 'hub' ? 'pt-0 lg:pt-0' : 'pt-[56px] lg:pt-0'} h-[100dvh] overflow-y-auto no-scrollbar relative w-full`}>
        <div className={`max-w-7xl mx-auto ${activeTab === 'hub' ? 'px-0 py-0 pb-20' : 'px-3 sm:px-6 lg:px-8 py-4 lg:py-8 pb-28 lg:pb-12'} w-full min-w-0`}>
          {/* Tab Content */}
          <div className="animate-fade-in w-full min-w-0">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};


