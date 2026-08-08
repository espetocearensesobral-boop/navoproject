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
  LogOut
} from 'lucide-react';
import { AdminTab } from './AdminLayout';
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

      {/* Grid de Módulos */}
      <main className="px-4 pb-12">
        <p className="text-xs text-content-muted uppercase tracking-wider mb-3 mt-2 font-bold">Módulos</p>
        <div className="grid grid-cols-2 gap-3">

          {/* PDV / Caixa (destaque col-span-2) */}
          <div 
            onClick={() => onSelectTab('pdv')}
            className="col-span-2 bg-surface-card border border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden shadow-md hover:border-gold-base group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-gold-base/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-gold-base/15 flex items-center justify-center flex-shrink-0 text-gold-base group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-content-base text-base">PDV / Caixa</h3>
                  <span className="text-[10px] text-gold-base bg-gold-base/10 border border-gold-base/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Principal
                  </span>
                </div>
                <p className="text-xs text-content-muted mt-0.5 truncate">Abrir caixa e registrar vendas</p>
              </div>
              <ChevronRight className="w-5 h-5 text-content-muted group-hover:text-gold-base flex-shrink-0 transition-colors" />
            </div>
          </div>

          {/* Dashboard */}
          <div 
            onClick={() => onSelectTab('dashboard')}
            className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center mb-3 group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-content-base">Dashboard</h3>
            <p className="text-[11px] text-content-muted mt-0.5">Visão geral</p>
          </div>

          {/* Agenda */}
          <div 
            onClick={() => onSelectTab('agenda')}
            className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-status-success bg-status-success/10 border border-status-success/30 px-2 py-0.5 rounded-full font-bold">
                {todayAppointmentsCount}
              </span>
            </div>
            <h3 className="font-semibold text-sm text-content-base">Agenda</h3>
            <p className="text-[11px] text-content-muted mt-0.5">Horários</p>
          </div>

          {/* Fila de Espera */}
          <div 
            onClick={() => onSelectTab('queue')}
            className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                {queueCount}
              </span>
            </div>
            <h3 className="font-semibold text-sm text-content-base">Fila</h3>
            <p className="text-[11px] text-content-muted mt-0.5">Espera</p>
          </div>

          {/* Rewards & NPS */}
          <div 
            onClick={() => onSelectTab('rewards')}
            className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center mb-3 group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-content-base">Rewards</h3>
            <p className="text-[11px] text-content-muted mt-0.5">Fidelidade</p>
          </div>

          {/* Serviços */}
          <div 
            onClick={() => onSelectTab('servicos')}
            className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center mb-3 group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
              <Scissors className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-content-base">Serviços</h3>
            <p className="text-[11px] text-content-muted mt-0.5">{servicesCount} itens</p>
          </div>

          {/* Profissionais */}
          <div 
            onClick={() => onSelectTab('profissionais')}
            className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center mb-3 group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-content-base">Equipe</h3>
            <p className="text-[11px] text-content-muted mt-0.5">{professionalsCount} barbeiros</p>
          </div>

          {/* Clientes */}
          <div 
            onClick={() => onSelectTab('clientes')}
            className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center mb-3 group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
              <UserCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-content-base">Clientes</h3>
            <p className="text-[11px] text-content-muted mt-0.5">{clientCount}</p>
          </div>

          {/* Perfil & Unidade */}
          <div 
            onClick={() => onSelectTab('barbearia')}
            className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center mb-3 group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
              <Store className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-content-base">Unidade</h3>
            <p className="text-[11px] text-content-muted mt-0.5">Perfil & Lojas</p>
          </div>

          {/* Configurações */}
          <div 
            onClick={() => onSelectTab('settings')}
            className="bg-surface-card border border-border-subtle hover:border-gold-base/50 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center mb-3 group-hover:bg-gold-base group-hover:text-surface-base transition-colors">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-content-base">Ajustes</h3>
            <p className="text-[11px] text-content-muted mt-0.5">Configurar</p>
          </div>

        </div>
      </main>
    </div>
  );
};
