import React, { useEffect, useState } from 'react';
import { Cake, Mail, Phone, Search, RefreshCw, CalendarDays, Gift } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { AdminPageHeader } from './shared/AdminPageHeader';

interface BirthdayClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthday: string;
  month: number;
  day: number;
  daysUntil: number;
  age: number | null;
  lastVisit: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  loyaltyTier: string;
}

interface BirthdayResponse {
  summary: { totalWithBirthday: number; shown: number; currentMonth: number; next7Days: number; next30Days: number; withoutEmail: number };
  monthlyDistribution: { month: number; count: number }[];
  clients: BirthdayClient[];
}

const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fullMonthLabels = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
const whatsappUrl = (phone: string) => `https://wa.me/55${phone.replace(/\D/g, '')}`;

export const BirthdaysManagement: React.FC = () => {
  const [period, setPeriod] = useState('current');
  const [tier, setTier] = useState('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<BirthdayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month: period, tier });
      if (search.trim()) params.set('search', search.trim());
      const res = await authFetch(`/api/relationship/birthdays?${params.toString()}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Não foi possível carregar os aniversariantes.');
      setData(body);
    } catch (err: any) {
      setError(err.message || 'Não foi possível carregar os aniversariantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period, tier]);

  const summary = data?.summary || { totalWithBirthday: 0, shown: 0, currentMonth: 0, next7Days: 0, next30Days: 0, withoutEmail: 0 };
  const clients = data?.clients || [];
  const distribution = data?.monthlyDistribution || [];

  return (
    <div className="space-y-4 animate-in fade-in duration-300 min-w-0">
      <AdminPageHeader
        icon={Cake}
        title="Aniversariantes"
        stats={[
          { label: 'este mês', value: summary.currentMonth, tone: 'gold' },
          { label: 'próximos 7 dias', value: summary.next7Days, tone: 'warning' },
          { label: 'com aniversário', value: summary.totalWithBirthday, tone: 'info' },
        ]}
        action={{ label: 'Atualizar', onClick: load }}
      />

      <div className="bg-surface-card border border-border-subtle rounded-xl p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Buscar aniversariante..." className="w-full h-11 bg-surface-base border border-border-subtle rounded-xl pl-9 pr-3 text-sm text-content-base focus:outline-none focus:border-gold-base" />
          </div>
          <button type="button" onClick={load} className="h-11 px-4 rounded-xl bg-gold-base text-surface-base text-xs font-bold flex items-center justify-center gap-2"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
        </div>
        <div data-gesture-scroll="horizontal" className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          <button type="button" onClick={() => setPeriod('current')} className={`shrink-0 min-h-10 px-4 rounded-xl border text-sm font-semibold ${period === 'current' ? 'bg-gold-base text-surface-base border-gold-base' : 'bg-surface-base text-content-muted border-border-subtle'}`}>Este mês</button>
          <button type="button" onClick={() => setPeriod('upcoming')} className={`shrink-0 min-h-10 px-4 rounded-xl border text-sm font-semibold ${period === 'upcoming' ? 'bg-gold-base text-surface-base border-gold-base' : 'bg-surface-base text-content-muted border-border-subtle'}`}>Próximos 30 dias</button>
          <button type="button" onClick={() => setPeriod('all')} className={`shrink-0 min-h-10 px-4 rounded-xl border text-sm font-semibold ${period === 'all' ? 'bg-gold-base text-surface-base border-gold-base' : 'bg-surface-base text-content-muted border-border-subtle'}`}>Ano inteiro</button>
          {fullMonthLabels.map((label, index) => (
            <button key={label} type="button" onClick={() => setPeriod(String(index + 1))} className={`shrink-0 min-h-10 px-3 rounded-xl border text-sm font-semibold ${period === String(index + 1) ? 'bg-gold-base text-surface-base border-gold-base' : 'bg-surface-base text-content-muted border-border-subtle'}`}>{label}</button>
          ))}
        </div>
        <div data-gesture-scroll="horizontal" className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {['all', 'Bronze', 'Prata', 'Ouro', 'Diamante'].map((value) => (
            <button key={value} type="button" onClick={() => setTier(value)} className={`shrink-0 min-h-9 px-3 rounded-xl border text-xs font-semibold ${tier === value ? 'bg-surface-card border-gold-base text-gold-base' : 'bg-surface-base border-border-subtle text-content-muted'}`}>{value === 'all' ? 'Todos os níveis' : value}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface-card border border-border-subtle rounded-xl p-3"><p className="text-xs uppercase tracking-wider text-content-muted">Próximos 30 dias</p><p className="text-xl font-black text-content-base mt-1">{summary.next30Days}</p></div>
        <div className="bg-surface-card border border-border-subtle rounded-xl p-3"><p className="text-xs uppercase tracking-wider text-content-muted">Sem e-mail</p><p className="text-xl font-black text-status-warning mt-1">{summary.withoutEmail}</p></div>
        <div className="bg-surface-card border border-border-subtle rounded-xl p-3"><p className="text-xs uppercase tracking-wider text-content-muted">Exibidos</p><p className="text-xl font-black text-gold-base mt-1">{summary.shown}</p></div>
        <div className="bg-surface-card border border-border-subtle rounded-xl p-3"><p className="text-xs uppercase tracking-wider text-content-muted">Base completa</p><p className="text-xl font-black text-content-base mt-1">{summary.totalWithBirthday}</p></div>
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-gold-base" /><h2 className="text-sm font-bold text-content-base">Distribuição anual</h2></div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end">
          {distribution.map((item) => {
            const max = Math.max(1, ...distribution.map((month) => month.count));
            return <div key={item.month} className="text-center space-y-1"><div className="h-16 flex items-end justify-center"><div className="w-full max-w-6 rounded-t-md bg-gold-base/70" style={{ height: `${Math.max(8, (item.count / max) * 100)}%` }} /></div><p className="text-xs text-content-muted">{monthLabels[item.month - 1]}</p><p className="text-xs font-bold text-content-base">{item.count}</p></div>;
          })}
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-status-error/10 border border-status-error/30 text-status-error text-sm font-semibold">{error}</div>}
      {loading ? <div className="py-16 flex justify-center"><div className="w-7 h-7 border-2 border-gold-base border-t-transparent rounded-full animate-spin" /></div> : clients.length === 0 ? (
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-10 text-center space-y-2"><Gift className="w-10 h-10 text-content-muted mx-auto" /><h3 className="text-base font-bold text-content-base">Nenhum aniversariante encontrado</h3><p className="text-sm text-content-muted">Cadastre a data de aniversário no perfil do cliente para incluí-lo nesta visão.</p></div>
      ) : (
        <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-content-base">Lista de aniversariantes</p><p className="text-xs text-content-muted">Use os canais manuais enquanto as automações não forem ativadas.</p></div><span className="text-xs font-bold text-gold-base">{clients.length} encontrados</span></div>
          <div className="divide-y divide-border-subtle">
            {clients.map((client) => (
              <article key={client.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 rounded-full bg-gold-base/10 text-gold-base flex items-center justify-center shrink-0"><Cake className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><h3 className="text-sm font-bold text-content-base admin-clamp-2">{client.name}</h3><span className="px-2 py-1 rounded-md bg-surface-base border border-border-subtle text-xs text-content-muted">{client.loyaltyTier}</span></div><p className="text-xs text-content-muted">{formatDate(client.birthday)}{client.age !== null ? ` · ${client.age} anos` : ''} · Última visita: {client.lastVisit ? formatDate(client.lastVisit) : 'sem registro'}</p></div>
                <div className="sm:text-right shrink-0"><p className="text-xs uppercase tracking-wider text-content-muted">Quando</p><p className={`text-sm font-black ${client.daysUntil <= 7 ? 'text-status-warning' : 'text-gold-base'}`}>{client.daysUntil === 0 ? 'Hoje' : `em ${client.daysUntil} dias`}</p></div>
                <div className="flex items-center gap-2 shrink-0">{client.hasPhone && <a href={whatsappUrl(client.phone)} target="_blank" rel="noreferrer" title="Abrir WhatsApp" className="w-10 h-10 rounded-xl border border-status-success/30 text-status-success flex items-center justify-center"><Phone className="w-4 h-4" /></a>}{client.hasEmail && <a href={`mailto:${client.email}`} title="Enviar e-mail" className="w-10 h-10 rounded-xl border border-gold-base/30 text-gold-base flex items-center justify-center"><Mail className="w-4 h-4" /></a>}</div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
