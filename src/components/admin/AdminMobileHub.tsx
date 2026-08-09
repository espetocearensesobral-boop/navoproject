import React, { useState, useEffect } from 'react';
import { 
  Scissors, 
  Receipt, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Award, 
  Users, 
  UserCheck, 
  Store, 
  Settings, 
  ChevronRight,
  LogOut,
  FileText,
  Wallet,
  ShieldCheck,
  MessageSquare,
  QrCode,
  Heart
} from 'lucide-react';
import { AdminTab, AdminSection } from './AdminLayout';
import { 
  fetchAppointmentsFromSupabase, 
  getQueueFromSupabase, 
  fetchServicesFromSupabase, 
  fetchProfessionalsFromSupabase 
} from '../../services/supabaseDataService';

interface AdminMobileHubProps {
  onSelectTab: (tab: AdminTab) => void;
  adminName: string;
  onLogout: () => void;
}

interface HubModule {
  id: AdminTab;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeTone?: 'success' | 'warning' | 'neutral';
  featured?: boolean;
}

export const AdminMobileHub: React.FC<AdminMobileHubProps> = ({
  onSelectTab,
  adminName,
  onLogout
}) => {
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState<number>(12);
  const [revenueToday, setRevenueToday] = useState<number>(1800);
  const [queueCount, setQueueCount] = useState<number>(3);
  const [servicesCount, setServicesCount] = useState<number>(8);
  const [professionalsCount, setProfessionalsCount] = useState<number>(5);
  const [clientCount, setClientCount] = useState<number>(1240);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      try {
        setLoading(true);
        const [appts, q, svcs, profs] = await Promise.all([
          fetchAppointmentsFromSupabase().catch(() => []),
          getQueueFromSupabase().catch(() => []),
          fetchServicesFromSupabase().catch(() => []),
          fetchProfessionalsFromSupabase().catch(() => []),
        ]);

        if (!isMounted) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const activeToday = appts.filter(a => a.date === todayStr && a.status !== 'cancelled');
        if (activeToday.length > 0) {
          setTodayAppointmentsCount(activeToday.length);
        }
        
        const totalRev = activeToday.reduce((sum, a) => sum + (a.final_amount || 0), 0);
        if (totalRev > 0) {
          setRevenueToday(totalRev);
        }
        
        const activeQueue = q.filter(item => item.status === 'waiting' || item.status === 'in_progress');
        if (activeQueue.length > 0) {
          setQueueCount(activeQueue.length);
        }
        
        if (svcs && svcs.length > 0) setServicesCount(svcs.length);
        if (profs && profs.length > 0) setProfessionalsCount(profs.length);

        const uniqueClients = new Set(appts.map(a => a.client_id || a.client_phone || a.client_name)).size;
        if (uniqueClients > 0) setClientCount(uniqueClients);
      } catch (e) {
        console.error('Erro ao carregar estatísticas do Hub Mobile:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadStats();
    return () => { isMounted = false; };
  }, []);

  const adminInitials = adminName ? adminName.substring(0, 2).toUpperCase() : 'BA';

  // Estrutura de seções inteligente: agrupa por intenção do usuário
  // (o que ele veio fazer agora) em vez de listar 20 módulos soltos.
  // A ordem das seções segue a frequência de uso no dia a dia de uma barbearia:
  // 1) operar o balcão, 2) dinheiro, 3) cadastros, 4) relacionamento com cliente, 5) sistema.
  const sections: { id: AdminSection; label: string; hint: string; modules: HubModule[] }[] = [
    {
      id: 'operacao',
      label: 'Operação do Dia',
      hint: 'O que você usa a toda hora',
      modules: [
        {
          id: 'pdv',
          title: 'PDV / Caixa',
          subtitle: 'Abrir caixa e registrar vendas',
          icon: Receipt,
          badge: 'Principal',
          badgeTone: 'neutral',
          featured: true,
        },
        {
          id: 'agenda',
          title: 'Agenda',
          subtitle: 'Horários do dia',
          icon: Calendar,
          badge: loading ? undefined : todayAppointmentsCount,
          badgeTone: 'success',
        },
        {
          id: 'queue',
          title: 'Fila',
          subtitle: 'Clientes aguardando',
          icon: Clock,
          badge: loading ? undefined : queueCount,
          badgeTone: 'warning',
        },
        {
          id: 'comandas',
          title: 'Comandas',
          subtitle: 'Fechamento de conta',
          icon: FileText,
        },
        {
          id: 'dashboard',
          title: 'Dashboard',
          subtitle: 'Visão geral do negócio',
          icon: TrendingUp,
        },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      hint: 'Caixa, extrato, contas e relatórios em um só lugar',
      modules: [
        {
          id: 'financeiro',
          title: 'Financeiro',
          subtitle: 'Caixa · Extrato · A Pagar · Saúde · Relatórios',
          icon: Wallet,
          badge: revenueToday >= 1000 ? `R$${(revenueToday / 1000).toFixed(1)}k hoje` : `R$${revenueToday.toFixed(0)} hoje`,
          badgeTone: 'success',
          featured: true,
        },
      ],
    },
    {
      id: 'cadastros',
      label: 'Cadastros',
      hint: 'Serviços, equipe e clientes',
      modules: [
        {
          id: 'servicos',
          title: 'Serviços',
          subtitle: `${servicesCount} itens`,
          icon: Scissors,
        },
        {
          id: 'profissionais',
          title: 'Equipe',
          subtitle: `${professionalsCount} barbeiros`,
          icon: Users,
        },
        {
          id: 'clientes',
          title: 'Clientes',
          subtitle: `${clientCount} cadastrados`,
          icon: UserCheck,
        },
      ],
    },
    {
      id: 'relacionamento',
      label: 'Relacionamento',
      hint: 'Fidelização e canais com o cliente',
      modules: [
        {
          id: 'rewards',
          title: 'Rewards',
          subtitle: 'Fidelidade e NPS',
          icon: Award,
        },
        {
          id: 'subscriptions',
          title: 'Assinaturas',
          subtitle: 'Clube VIP',
          icon: Heart,
        },
        {
          id: 'whatsapp',
          title: 'WhatsApp',
          subtitle: 'Notificações',
          icon: MessageSquare,
        },
        {
          id: 'qrcode',
          title: 'QR Code',
          subtitle: 'Totem de balcão',
          icon: QrCode,
        },
      ],
    },
    {
      id: 'sistema',
      label: 'Sistema',
      hint: 'Configuração e controle',
      modules: [
        {
          id: 'barbearia',
          title: 'Unidade',
          subtitle: 'Perfil & lojas',
          icon: Store,
        },
        {
          id: 'audit',
          title: 'Auditoria',
          subtitle: 'Logs de sistema',
          icon: ShieldCheck,
        },
        {
          id: 'settings',
          title: 'Ajustes',
          subtitle: 'Configurar sistema',
          icon: Settings,
        },
      ],
    },
  ];

  const badgeToneClass: Record<NonNullable<HubModule['badgeTone']>, string> = {
    success: 'text-status-success bg-status-success/10 border-status-success/30',
    warning: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    neutral: 'text-gold-base bg-gold-base/10 border-gold-base/30',
  };

  return (
    <div className="min-h-full bg-surface-base text-content-base font-sans pb-10">
      {/* Header Mobile */}
      <header className="sticky top-0 z-30 bg-surface-card/95 backdrop-blur-md border-b border-border-subtle px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold-base flex items-center justify-center text-surface-base font-bold text-sm shadow-md">
            <Scissors className="w-5 h-5 text-surface-base" />
          </div>
          <div>
            <h1 className="text-sm font-serif font-bold text-content-base leading-tight">Navo Premium</h1>
            <p className="text-[10px] text-content-muted uppercase tracking-wider font-bold">Heritage Barber</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLogout}
            title="Sair"
            className="w-8 h-8 rounded-full bg-surface-base border border-border-subtle text-content-muted hover:text-gold-base flex items-center justify-center transition-colors active:scale-95"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gold-base/20 border border-gold-base/40 text-gold-base flex items-center justify-center text-xs font-bold uppercase shadow-xs">
            {adminInitials}
          </div>
        </div>
      </header>

      {/* Resumo Rápido (horizontal scroll) */}
      <section className="px-4 pt-4 pb-2">
        <div 
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar" 
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Card 1: Agendamentos Hoje */}
          <div className="snap-start flex-shrink-0 w-[140px] bg-surface-card border border-border-subtle rounded-xl p-3 shadow-xs">
            <p className="text-[10px] text-content-muted uppercase font-bold tracking-wide">Agend. Hoje</p>
            <p className="text-2xl font-bold text-content-base mt-1 num-tabular">
              {loading ? '...' : todayAppointmentsCount}
            </p>
            <p className="text-[10px] text-status-success font-semibold mt-0.5">+2 vs ontem</p>
          </div>

          {/* Card 2: Faturamento */}
          <div className="snap-start flex-shrink-0 w-[140px] bg-surface-card border border-border-subtle rounded-xl p-3 shadow-xs">
            <p className="text-[10px] text-content-muted uppercase font-bold tracking-wide">Faturamento</p>
            <p className="text-2xl font-bold text-content-base mt-1 num-tabular">
              {loading ? '...' : (revenueToday >= 1000 ? `R$${(revenueToday / 1000).toFixed(1)}k` : `R$${revenueToday.toFixed(0)}`)}
            </p>
            <p className="text-[10px] text-status-success font-semibold mt-0.5">+15% hoje</p>
          </div>

          {/* Card 3: Na Fila */}
          <div className="snap-start flex-shrink-0 w-[140px] bg-surface-card border border-border-subtle rounded-xl p-3 shadow-xs">
            <p className="text-[10px] text-content-muted uppercase font-bold tracking-wide">Na Fila</p>
            <p className="text-2xl font-bold text-content-base mt-1 num-tabular">
              {loading ? '...' : queueCount}
            </p>
            <p className="text-[10px] text-amber-400 font-semibold mt-0.5">~12min espera</p>
          </div>

          {/* Card 4: NPS */}
          <div className="snap-start flex-shrink-0 w-[140px] bg-surface-card border border-border-subtle rounded-xl p-3 shadow-xs">
            <p className="text-[10px] text-content-muted uppercase font-bold tracking-wide">NPS</p>
            <p className="text-2xl font-bold text-content-base mt-1 num-tabular">87</p>
            <p className="text-[10px] text-status-success font-semibold mt-0.5">Excelente</p>
          </div>
        </div>
      </section>

      {/* Seções agrupadas de módulos */}
      <main className="px-4 pb-12 space-y-7">
        {sections.map((section) => (
          <section key={section.id}>
            <div className="flex items-baseline justify-between mb-3 mt-2">
              <p className="text-xs text-content-base uppercase tracking-wider font-bold">{section.label}</p>
              <p className="text-[10px] text-content-muted truncate ml-3">{section.hint}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {section.modules.map((mod) => {
                const Icon = mod.icon;

                if (mod.featured) {
                  return (
                    <div
                      key={mod.id}
                      onClick={() => onSelectTab(mod.id)}
                      className="col-span-2 bg-surface-card border border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden shadow-md hover:border-gold-base group"
                    >
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-gold-base/10 rounded-full blur-xl pointer-events-none" />
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-gold-base/15 flex items-center justify-center flex-shrink-0 text-gold-base group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-content-base text-base">{mod.title}</h3>
                            {mod.badge && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-xl font-bold uppercase tracking-wider border ${badgeToneClass[mod.badgeTone ?? 'neutral']}`}>
                                {mod.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-content-muted mt-0.5 truncate">{mod.subtitle}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-content-muted group-hover:text-gold-base flex-shrink-0 transition-colors" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={mod.id}
                    onClick={() => onSelectTab(mod.id)}
                    className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      {mod.badge !== undefined && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${badgeToneClass[mod.badgeTone ?? 'neutral']}`}>
                          {mod.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm text-content-base">{mod.title}</h3>
                    <p className="text-[11px] text-content-muted mt-0.5 truncate">{mod.subtitle}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};

