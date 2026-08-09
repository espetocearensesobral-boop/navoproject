import React, { useState, useEffect } from 'react';
import { 
  fetchAppointmentsFromSupabase, 
  fetchServicesFromSupabase, 
  fetchProfessionalsFromSupabase 
} from '../../services/supabaseDataService';
import { Appointment, ServiceItem, Professional } from '../../types';
import { 
  BarChart3, 
  Scissors, 
  Users, 
  UserCheck, 
  TrendingUp, 
  Calendar, 
  Download, 
  Printer, 
  Sparkles, 
  PieChart, 
  DollarSign, 
  Filter, 
  Award, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';

export const ReportsManagement: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Sub-tab & Period Filter
  const [activeReportTab, setActiveReportTab] = useState<'services' | 'clients' | 'professionals'>('services');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apts, svcs, profs] = await Promise.all([
        fetchAppointmentsFromSupabase().catch(() => []),
        fetchServicesFromSupabase().catch(() => []),
        fetchProfessionalsFromSupabase().catch(() => [])
      ]);
      setAppointments(apts);
      setServices(svcs);
      setProfessionals(profs);
    } catch (e) {
      console.error('Erro ao carregar dados dos relatórios:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter appointments by selected period
  const getFilteredAppointments = () => {
    const now = new Date();
    return appointments.filter(apt => {
      if (apt.status === 'cancelled') return false;
      const aptDate = new Date(apt.date || Date.now());
      
      if (periodFilter === 'today') {
        return aptDate.toDateString() === now.toDateString();
      }
      if (periodFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
        return aptDate >= oneWeekAgo;
      }
      if (periodFilter === 'month') {
        return aptDate.getMonth() === now.getMonth() && aptDate.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'quarter') {
        const threeMonthsAgo = new Date(now.getTime() - 90 * 86400000);
        return aptDate >= threeMonthsAgo;
      }
      return true; // year / all
    });
  };

  const activeAppointments = getFilteredAppointments();

  // --- REPORT 1: SERVICES ANALYSIS ---
  const getServiceStats = () => {
    const map: Record<string, { title: string; count: number; totalRevenue: number }> = {};

    activeAppointments.forEach(apt => {
      const title = apt.services?.[0]?.title || 'Serviço Padrão';
      const rev = apt.final_amount || apt.original_amount || 60;

      if (!map[title]) {
        map[title] = { title, count: 0, totalRevenue: 0 };
      }
      map[title].count += 1;
      map[title].totalRevenue += rev;
    });

    return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
  };

  // --- REPORT 2: CLIENTS ANALYSIS ---
  const getClientStats = () => {
    const map: Record<string, { name: string; phone?: string; visits: number; totalSpent: number; lastVisit: string }> = {};

    activeAppointments.forEach(apt => {
      const key = apt.client_phone || apt.client_name;
      const rev = apt.final_amount || apt.original_amount || 60;
      const d = apt.date || new Date().toISOString().split('T')[0];

      if (!map[key]) {
        map[key] = { name: apt.client_name, phone: apt.client_phone, visits: 0, totalSpent: 0, lastVisit: d };
      }
      map[key].visits += 1;
      map[key].totalSpent += rev;
      if (d > map[key].lastVisit) {
        map[key].lastVisit = d;
      }
    });

    const clientList = Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent);
    const totalClientsCount = clientList.length;
    const returningClients = clientList.filter(c => c.visits > 1).length;
    const retentionRate = totalClientsCount > 0 ? ((returningClients / totalClientsCount) * 100).toFixed(1) : '0';

    return { clientList, totalClientsCount, returningClients, retentionRate };
  };

  // --- REPORT 3: PROFESSIONALS ANALYSIS ---
  const getProfessionalStats = () => {
    const map: Record<string, { name: string; servicesCount: number; totalGross: number; commissionRate: number; totalCommission: number; rating: number }> = {};

    // Initialize map from registered professionals
    professionals.forEach(p => {
      map[p.name] = {
        name: p.name,
        servicesCount: 0,
        totalGross: 0,
        commissionRate: p.commission_rate || 50,
        totalCommission: 0,
        rating: p.rating || 5.0
      };
    });

    activeAppointments.forEach(apt => {
      const name = apt.professional_name || 'Geral';
      const rev = apt.final_amount || apt.original_amount || 60;

      if (!map[name]) {
        map[name] = {
          name,
          servicesCount: 0,
          totalGross: 0,
          commissionRate: 50,
          totalCommission: 0,
          rating: 4.9
        };
      }
      map[name].servicesCount += 1;
      map[name].totalGross += rev;
      map[name].totalCommission += (rev * (map[name].commissionRate / 100));
    });

    return Object.values(map).sort((a, b) => b.totalGross - a.totalGross);
  };

  const serviceStats = getServiceStats();
  const { clientList, totalClientsCount, returningClients, retentionRate } = getClientStats();
  const professionalStats = getProfessionalStats();

  const totalPeriodRevenue = activeAppointments.reduce((acc, a) => acc + (a.final_amount || a.original_amount || 60), 0);
  const totalPeriodServices = activeAppointments.length;
  const avgTicket = totalPeriodServices > 0 ? (totalPeriodRevenue / totalPeriodServices) : 0;

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={BarChart3}
        title="Relatórios & Desempenho"
      >
        <div className="flex items-center gap-1 bg-surface-base p-1 rounded-xl border border-border-subtle shrink-0">
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'week', label: 'Semana' },
            { id: 'month', label: 'Mês' },
            { id: 'quarter', label: '90 Dias' },
            { id: 'year', label: 'Ano' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriodFilter(p.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodFilter === p.id
                  ? 'bg-gold-base text-surface-base shadow-xs'
                  : 'text-content-muted hover:text-content-base'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </AdminPageHeader>

      {/* Ações (mobile) */}
      <div className="md:hidden w-full flex items-center gap-1 bg-surface-base p-1 rounded-xl border border-border-subtle overflow-x-auto no-scrollbar">
        {[
          { id: 'today', label: 'Hoje' },
          { id: 'week', label: 'Semana' },
          { id: 'month', label: 'Mês' },
          { id: 'quarter', label: '90 Dias' },
          { id: 'year', label: 'Ano' }
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setPeriodFilter(p.id as any)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
              periodFilter === p.id
                ? 'bg-gold-base text-surface-base shadow-xs'
                : 'text-content-muted hover:text-content-base'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-card border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-content-muted block">Faturamento no Período</span>
          <span className="text-2xl font-bold text-gold-base mt-1 block tabular-nums">
            R$ {totalPeriodRevenue.toFixed(2)}
          </span>
          <span className="text-[10px] text-status-success font-semibold mt-1 block">
            {totalPeriodServices} atendimentos realizados
          </span>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-content-muted block">Ticket Médio por Serviço</span>
          <span className="text-2xl font-bold text-content-base mt-1 block tabular-nums">
            R$ {avgTicket.toFixed(2)}
          </span>
          <span className="text-[10px] text-content-muted font-semibold mt-1 block">
            Média por cliente atendido
          </span>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-content-muted block">Taxa de Retenção de Clientes</span>
          <span className="text-2xl font-bold text-status-success mt-1 block tabular-nums">
            {retentionRate}%
          </span>
          <span className="text-[10px] text-content-muted font-semibold mt-1 block">
            {returningClients} de {totalClientsCount} clientes retornaram
          </span>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="flex border-b border-border-subtle gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveReportTab('services')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeReportTab === 'services'
              ? 'border-gold-base text-gold-base'
              : 'border-transparent text-content-muted hover:text-content-base'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Relatório por Serviço</span>
        </button>

        <button
          onClick={() => setActiveReportTab('clients')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeReportTab === 'clients'
              ? 'border-gold-base text-gold-base'
              : 'border-transparent text-content-muted hover:text-content-base'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Relatório por Cliente</span>
        </button>

        <button
          onClick={() => setActiveReportTab('professionals')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeReportTab === 'professionals'
              ? 'border-gold-base text-gold-base'
              : 'border-transparent text-content-muted hover:text-content-base'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Relatório por Profissional</span>
        </button>
      </div>

      {/* SECTION 1: SERVICES REPORT */}
      {activeReportTab === 'services' && (
        <div className="space-y-4">
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-content-base mb-3 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-gold-base" />
              <span>Ranking de Serviços Mais Rentáveis</span>
            </h3>

            {serviceStats.length === 0 ? (
              <p className="text-xs text-content-muted py-4 text-center">
                Sem registros de atendimento no período selecionado.
              </p>
            ) : (
              <div className="space-y-3">
                {serviceStats.map((item, idx) => {
                  const sharePct = totalPeriodRevenue > 0 ? ((item.totalRevenue / totalPeriodRevenue) * 100).toFixed(1) : '0';
                  return (
                    <div key={idx} className="bg-surface-base p-3.5 rounded-xl border border-border-subtle space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-gold-base/15 text-gold-base text-[10px] font-bold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-content-base">{item.title}</span>
                          <span className="text-[10px] text-content-muted font-bold bg-surface-card px-2 py-0.5 rounded-xl border border-border-subtle">
                            {item.count} execuções
                          </span>
                        </div>
                        <span className="font-bold text-gold-base tabular-nums">
                          R$ {item.totalRevenue.toFixed(2)} ({sharePct}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-surface-card rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold-base rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Number(sharePct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: CLIENTS REPORT */}
      {activeReportTab === 'clients' && (
        <div className="space-y-4">
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-content-base mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-gold-base" />
              <span>Maiores Clientes em Faturamento (LTV)</span>
            </h3>

            {clientList.length === 0 ? (
              <p className="text-xs text-content-muted py-4 text-center">
                Nenhum histórico de cliente para o período selecionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-base border-b border-border-subtle text-content-muted uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-3">Posição</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3 text-center">Visitas</th>
                      <th className="p-3">Última Visita</th>
                      <th className="p-3 text-right">Total Investido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60 text-content-base">
                    {clientList.slice(0, 15).map((c, i) => (
                      <tr key={i} className="hover:bg-surface-base/50 transition-colors">
                        <td className="p-3 font-bold text-gold-base">#{i + 1}</td>
                        <td className="p-3 font-semibold">
                          {c.name}
                          {c.phone && <span className="text-[10px] text-content-muted block font-mono">{c.phone}</span>}
                        </td>
                        <td className="p-3 text-center font-bold">{c.visits}x</td>
                        <td className="p-3 text-content-muted">{new Date(c.lastVisit).toLocaleDateString('pt-BR')}</td>
                        <td className="p-3 text-right font-bold text-gold-base tabular-nums">
                          R$ {c.totalSpent.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: PROFESSIONALS REPORT */}
      {activeReportTab === 'professionals' && (
        <div className="space-y-4">
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-content-base mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-gold-base" />
              <span>Desempenho & Comissões dos Barbeiros</span>
            </h3>

            {professionalStats.length === 0 ? (
              <p className="text-xs text-content-muted py-4 text-center">
                Nenhum barbeiro cadastrado ou sem atendimentos no período.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {professionalStats.map((prof, i) => (
                  <div key={i} className="bg-surface-base border border-border-subtle rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gold-base text-surface-base font-bold text-xs flex items-center justify-center">
                          {prof.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-content-base">{prof.name}</h4>
                          <span className="text-[10px] text-content-muted font-semibold">
                            Comissão: {prof.commissionRate}%
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gold-base bg-gold-base/10 px-2 py-0.5 rounded-xl">
                        ★ {prof.rating.toFixed(1)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-surface-card p-2 rounded-lg border border-border-subtle/60">
                        <span className="text-[9px] text-content-muted uppercase font-bold block">Atendimentos</span>
                        <span className="font-bold text-content-base mt-0.5 block">{prof.servicesCount}</span>
                      </div>
                      <div className="bg-surface-card p-2 rounded-lg border border-border-subtle/60">
                        <span className="text-[9px] text-content-muted uppercase font-bold block">Gerado Bruto</span>
                        <span className="font-bold text-content-base mt-0.5 block tabular-nums">
                          R$ {prof.totalGross.toFixed(0)}
                        </span>
                      </div>
                      <div className="bg-surface-card p-2 rounded-lg border border-border-subtle/60">
                        <span className="text-[9px] text-content-muted uppercase font-bold block">Comissão R$</span>
                        <span className="font-bold text-status-success mt-0.5 block tabular-nums">
                          R$ {prof.totalCommission.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
