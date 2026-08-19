import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  CreditCard,
  Download,
  Loader2,
  PieChart,
  RefreshCw,
  Scissors,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  Printer,
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';
import {
  fetchFinancialReportFromSupabase,
  type FinancialPeriod,
  type FinancialReportData,
} from '../../services/supabaseDataService';
import { fetchOperationSettings } from '../../services/operationSettingsService';
import { defaultPrintSettings, fetchPrintSettings } from '../../services/printSettingsService';
import { escapePrintHtml, openPrintWindow } from '../../utils/printUtils';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const periodOptions: { id: FinancialPeriod; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: '7 dias' },
  { id: 'month', label: 'Mês' },
  { id: 'quarter', label: '90 dias' },
  { id: 'year', label: 'Ano' },
];

const paymentLabel: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  cash: 'Dinheiro',
  other: 'Outro',
};

type ReportTab = 'visao' | 'receitas' | 'despesas' | 'operacao';

export const ReportsManagement: React.FC = () => {
  const [period, setPeriod] = useState<FinancialPeriod>('month');
  const [tab, setTab] = useState<ReportTab>('visao');
  const [report, setReport] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshSeconds, setRefreshSeconds] = useState(30);

  const loadReport = async (selectedPeriod = period) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFinancialReportFromSupabase(selectedPeriod, { strict: true });
      setReport(data);
    } catch (requestError) {
      setReport(null);
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os relatórios financeiros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(period);
  }, [period]);

  useEffect(() => {
    fetchOperationSettings().then((settings) => setRefreshSeconds(settings.reportsRefreshSeconds)).catch(() => {});
  }, []);

  useEffect(() => {
    const refresh = () => loadReport(period);
    window.addEventListener('adminRefresh', refresh);
    return () => window.removeEventListener('adminRefresh', refresh);
  }, [period]);

  useEffect(() => {
    const timer = window.setInterval(() => loadReport(period), refreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [period, refreshSeconds]);

  const maxDaily = useMemo(() => Math.max(1, ...(report?.dailyCashFlow.map((item) => Math.max(item.income, item.expense)) || [1])), [report]);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Relatório financeiro', report.period.label],
      ['Período', `${report.period.from} até ${report.period.to}`],
      [],
      ['Resumo', 'Valor'],
      ['Entradas confirmadas', report.summary.totalIncome.toFixed(2)],
      ['Saídas confirmadas', report.summary.totalExpenses.toFixed(2)],
      ['Resultado líquido', report.summary.netResult.toFixed(2)],
      ['Recebimentos pendentes', report.summary.pendingAmount.toFixed(2)],
      [],
      ['Serviço', 'Execuções', 'Receita'],
      ...report.services.map((item) => [item.serviceTitle, String(item.count), item.revenue.toFixed(2)]),
      [],
      ['Categoria de saída', 'Lançamentos', 'Total'],
      ...report.expenseCategories.map((item) => [item.category, String(item.count), item.total.toFixed(2)]),
    ].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_financeiro_${report.period.from}_${report.period.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = async () => {
    if (!report) return;
    const settings = await fetchPrintSettings().catch(() => defaultPrintSettings);
    const metric = (label: string, value: string) => `<div class="print-row"><span>${escapePrintHtml(label)}</span><strong>${escapePrintHtml(value)}</strong></div>`;
    const details = settings.reportIncludeDetails ? `<hr class="print-divider"><h2>Serviços recebidos</h2>${report.services.map((item) => metric(item.serviceTitle, `${item.count} atendimento(s) — ${money(item.revenue)}`)).join('') || '<p>Nenhum serviço recebido no período.</p>'}<h2>Saídas por categoria</h2>${report.expenseCategories.map((item) => metric(item.category, `- ${money(item.total)}`)).join('') || '<p>Nenhuma saída registrada no período.</p>'}` : '';
    const chart = settings.reportIncludeCharts ? `<hr class="print-divider"><h2>Fluxo resumido</h2>${report.dailyCashFlow.slice(-14).map((item) => metric(item.date, `Entradas ${money(item.income)} · Saídas ${money(item.expense)}`)).join('')}` : '';
    const bodyHtml = `${settings.showLogo ? '<h1 class="print-center">Navo Barber &amp; Club</h1>' : ''}<h2 class="print-center">Relatório financeiro</h2><p class="print-center print-muted">${escapePrintHtml(report.period.label)} — ${escapePrintHtml(report.period.from)} até ${escapePrintHtml(report.period.to)}</p><hr class="print-divider">${metric('Entradas confirmadas', money(report.summary.totalIncome))}${metric('Saídas confirmadas', money(report.summary.totalExpenses))}${metric('Resultado líquido', money(report.summary.netResult))}${metric('Recebimentos pendentes', money(report.summary.pendingAmount))}${chart}${details}`;
    openPrintWindow({ title: 'Relatório financeiro', settings, format: settings.reportFormat, bodyHtml });
  };

  const summary = report?.summary;

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      <AdminPageHeader
        icon={BarChart3}
        title="Relatórios"
        stats={report ? [
          { label: report.period.label.toLowerCase(), value: `${report.summary.incomeCount} entradas`, tone: 'neutral' },
          { label: 'pendente', value: money(report.summary.pendingAmount), tone: report.summary.pendingAmount > 0 ? 'warning' : 'muted' },
        ] : undefined}
        action={{ label: 'Exportar CSV', onClick: exportCsv, icon: Download, disabled: !report || loading }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="admin-category-scroll flex gap-2 overflow-x-auto no-scrollbar pb-1" data-gesture-scroll="horizontal">
          {periodOptions.map((option) => <button key={option.id} type="button" onClick={() => setPeriod(option.id)} className={`shrink-0 h-10 px-4 rounded-full text-sm font-bold transition-colors ${period === option.id ? 'bg-gold-base text-surface-base' : 'bg-surface-card border border-border-subtle text-content-muted hover:text-content-base'}`}>{option.label}</button>)}
        </div>
        <div className="flex gap-2"><button type="button" onClick={printReport} disabled={!report || loading} className="h-10 px-4 rounded-xl border border-border-subtle bg-surface-card text-sm font-bold text-content-muted hover:text-content-base flex items-center justify-center gap-2 disabled:opacity-50"><Printer className="w-4 h-4" />Imprimir</button><button type="button" onClick={() => loadReport()} className="h-10 px-4 rounded-xl border border-border-subtle bg-surface-card text-sm font-bold text-content-muted hover:text-content-base flex items-center justify-center gap-2"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button></div>
      </div>

      {error && <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-3.5 text-sm font-semibold text-status-error">{error}</div>}

      {loading && !report ? <div className="bg-surface-card border border-border-subtle rounded-xl p-12 text-center text-content-muted"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando relatório…</div> : report && summary && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Entradas" value={money(summary.totalIncome)} detail={`${summary.incomeCount} lançamento${summary.incomeCount === 1 ? '' : 's'} confirmado${summary.incomeCount === 1 ? '' : 's'}`} icon={ArrowUpRight} tone="positive" />
          <MetricCard label="Saídas" value={money(summary.totalExpenses)} detail={`${summary.expenseCount} despesa${summary.expenseCount === 1 ? '' : 's'} registrada${summary.expenseCount === 1 ? '' : 's'}`} icon={ArrowDownRight} tone="negative" />
          <MetricCard label="Resultado líquido" value={money(summary.netResult)} detail="Entradas menos saídas" icon={summary.netResult >= 0 ? TrendingUp : TrendingDown} tone={summary.netResult >= 0 ? 'positive' : 'negative'} />
          <MetricCard label="A receber" value={money(summary.pendingAmount)} detail={`${summary.pendingCount} recebimento${summary.pendingCount === 1 ? '' : 's'} pendente${summary.pendingCount === 1 ? '' : 's'}`} icon={WalletCards} tone={summary.pendingAmount > 0 ? 'warning' : 'neutral'} />
        </div>

        <AdminTabs
          tabs={[
            { id: 'visao', label: 'Visão geral', icon: PieChart },
            { id: 'receitas', label: 'Receitas', icon: ArrowUpRight },
            { id: 'despesas', label: 'Despesas', icon: ArrowDownRight },
            { id: 'operacao', label: 'Clientes & equipe', icon: Users },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as ReportTab)}
        />

        {tab === 'visao' && <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
          <section className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="admin-copy-title text-base font-serif font-bold text-content-base">Fluxo do período</h2><p className="mt-1 text-sm text-content-muted">Entradas e saídas por dia.</p></div><CalendarRange className="w-5 h-5 text-gold-base shrink-0" /></div>{report.dailyCashFlow.length === 0 ? <EmptyState text="Não há lançamentos confirmados neste período." /> : <div className="mt-6 h-52 flex items-end gap-2 sm:gap-3">{report.dailyCashFlow.map((day) => <div key={day.date} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1.5 group"><div className="w-full flex justify-center items-end gap-1 h-[calc(100%-1.75rem)]"><span title={`Entradas: ${money(day.income)}`} className="w-[42%] max-w-5 bg-status-success/75 rounded-t-md transition-all" style={{ height: `${Math.max(day.income ? 5 : 0, (day.income / maxDaily) * 100)}%` }} /><span title={`Saídas: ${money(day.expense)}`} className="w-[42%] max-w-5 bg-status-error/70 rounded-t-md transition-all" style={{ height: `${Math.max(day.expense ? 5 : 0, (day.expense / maxDaily) * 100)}%` }} /></div><span className="text-xs font-mono text-content-muted whitespace-nowrap">{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</span></div>)}</div>}<div className="mt-4 flex flex-wrap gap-4 text-xs text-content-muted"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-status-success/75" />Entradas</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-status-error/70" />Saídas</span></div></section>
          <section className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5"><h2 className="admin-copy-title text-base font-serif font-bold text-content-base">Entradas</h2><p className="mt-1 text-sm text-content-muted">Valores confirmados.</p><div className="mt-5 space-y-3"><InfoRow label="Serviços recebidos" value={money(summary.serviceRevenue)} tone="positive" /><InfoRow label="Outras entradas" value={money(summary.otherIncome)} tone="positive" /><InfoRow label="Ticket médio real" value={money(summary.ticketAverage)} tone="positive" /><div className="pt-3 mt-3 border-t border-border-subtle"><InfoRow label="Recebimentos concluídos" value={`${summary.receivedCount}`} /></div></div></section>
        </div>}

        {tab === 'receitas' && <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <section className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5"><SectionTitle icon={Scissors} title="Serviços recebidos" description="Ranking por pagamentos confirmados." />{report.services.length === 0 ? <EmptyState text="Nenhum recebimento de serviço confirmado no período." /> : <div className="mt-4 space-y-3">{report.services.map((service, index) => <RankRow key={service.serviceTitle} position={index + 1} title={service.serviceTitle} subtitle={`${service.count} atendimento${service.count === 1 ? '' : 's'} · ticket ${money(service.averageTicket)}`} value={money(service.revenue)} percentage={summary.serviceRevenue ? (service.revenue / summary.serviceRevenue) * 100 : 0} />)}</div>}</section>
          <section className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5"><SectionTitle icon={CreditCard} title="Formas de pagamento" description="Distribuição dos recebimentos." />{report.paymentMethods.length === 0 ? <EmptyState text="Nenhuma forma de pagamento registrada no período." /> : <div className="mt-4 space-y-3">{report.paymentMethods.map((method) => <RankRow key={method.method} position={null} title={paymentLabel[method.method] || method.method} subtitle={`${method.count} pagamento${method.count === 1 ? '' : 's'}`} value={money(method.total)} percentage={summary.serviceRevenue ? (method.total / summary.serviceRevenue) * 100 : 0} />)}</div>}</section>
        </div>}

        {tab === 'despesas' && <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
          <section className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5"><SectionTitle icon={ArrowDownRight} title="Saídas por categoria" description="Despesas do extrato real." />{report.expenseCategories.length === 0 ? <EmptyState text="Nenhuma saída registrada no período." /> : <div className="mt-4 space-y-3">{report.expenseCategories.map((expense, index) => <RankRow key={expense.category} position={index + 1} title={expense.category} subtitle={`${expense.count} lançamento${expense.count === 1 ? '' : 's'}`} value={`- ${money(expense.total)}`} valueTone="negative" percentage={summary.totalExpenses ? (expense.total / summary.totalExpenses) * 100 : 0} />)}</div>}</section>
          <section className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5"><h2 className="admin-copy-title text-base font-serif font-bold text-content-base">Leitura do resultado</h2><p className="mt-1 text-sm text-content-muted">Resumo do período.</p><div className="mt-5 p-4 rounded-xl bg-surface-base border border-border-subtle"><p className="text-xs font-bold uppercase tracking-wider text-content-muted">Margem após saídas</p><p className={`mt-2 text-2xl font-mono font-bold ${summary.netResult >= 0 ? 'finance-positive' : 'finance-negative'}`}>{money(summary.netResult)}</p><p className="mt-2 text-sm text-content-muted">Entradas confirmadas de {money(summary.totalIncome)} menos despesas de {money(summary.totalExpenses)}.</p></div><div className="mt-4 text-sm text-content-muted leading-relaxed">As saídas são incluídas no momento em que são salvas na aba <strong className="text-content-base">Saídas</strong>; para corrigir um lançamento, edite-o ou remova-o nessa mesma aba, e o Extrato e os Relatórios serão atualizados.</div></section>
        </div>}

        {tab === 'operacao' && <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <section className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5"><SectionTitle icon={UserRound} title="Clientes por valor recebido" description={`${summary.returningClientCount} cliente${summary.returningClientCount === 1 ? '' : 's'} recorrente${summary.returningClientCount === 1 ? '' : 's'} de ${summary.clientCount} no período · retenção de ${summary.retentionRate.toFixed(1)}%.`} />{report.clients.length === 0 ? <EmptyState text="Nenhum cliente com recebimento confirmado no período." /> : <div className="mt-4 space-y-2">{report.clients.slice(0, 12).map((client, index) => <div key={`${client.clientName}-${index}`} className="p-3 rounded-xl bg-surface-base border border-border-subtle flex items-center gap-3"><span className="w-8 h-8 rounded-lg bg-gold-base/10 text-gold-base font-bold text-xs shrink-0 flex items-center justify-center">#{index + 1}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-content-base admin-clamp-2">{client.clientName}</p><p className="mt-0.5 text-xs text-content-muted">{client.visits} visita{client.visits === 1 ? '' : 's'} recebida{client.visits === 1 ? '' : 's'}{client.clientPhone ? ` · ${client.clientPhone}` : ''}</p></div><p className="text-sm font-mono font-bold finance-positive shrink-0">{money(client.totalSpent)}</p></div>)}</div>}</section>
          <section className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5"><SectionTitle icon={Users} title="Profissionais por receita" description="Receita e comissão estimada." />{report.professionals.length === 0 ? <EmptyState text="Nenhum recebimento associado a profissional no período." /> : <div className="mt-4 space-y-3">{report.professionals.map((professional, index) => <div key={professional.professionalName} className="p-3.5 rounded-xl bg-surface-base border border-border-subtle"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold text-content-base admin-clamp-2">{professional.professionalName}</p><p className="mt-0.5 text-xs text-content-muted">{professional.servicesCount} serviço{professional.servicesCount === 1 ? '' : 's'} · comissão {professional.commissionRate.toFixed(1)}%</p></div><p className="text-sm font-mono font-bold finance-positive shrink-0">{money(professional.revenue)}</p></div><div className="mt-3 pt-3 border-t border-border-subtle flex justify-between text-xs"><span className="text-content-muted">Comissão estimada</span><strong className="finance-negative">{money(professional.commissionAmount)}</strong></div></div>)}</div>}</section>
        </div>}
      </>}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; detail: string; icon: React.ElementType; tone: 'positive' | 'negative' | 'warning' | 'neutral' }> = ({ label, value, detail, icon: Icon, tone }) => {
  const toneClass = tone === 'positive' ? 'text-status-success bg-status-success/10' : tone === 'negative' ? 'text-status-error bg-status-error/10' : tone === 'warning' ? 'text-amber-500 bg-amber-500/10' : 'text-gold-base bg-gold-base/10';
  const valueClass = tone === 'positive' ? 'finance-positive' : tone === 'negative' ? 'finance-negative' : 'text-content-base';
  return <div className="min-w-0 p-3.5 sm:p-4 bg-surface-card border border-border-subtle rounded-xl"><div className="flex items-start justify-between gap-2"><p className="admin-copy-label text-xs font-bold uppercase tracking-wider text-content-muted admin-safe-wrap">{label}</p><span className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${toneClass}`}><Icon className="w-4 h-4" /></span></div><p className={`mt-3 text-lg sm:text-xl font-mono font-bold truncate ${valueClass}`}>{value}</p><p className="admin-copy-description text-xs text-content-muted admin-safe-wrap">{detail}</p></div>;
};

const SectionTitle: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({ icon: Icon, title, description }) => <div><h2 className="admin-copy-title text-base font-serif font-bold text-content-base flex items-center gap-2"><Icon className="w-4 h-4 text-gold-base" />{title}</h2><p className="admin-copy-description mt-1 text-sm text-content-muted">{description}</p></div>;

const EmptyState: React.FC<{ text: string }> = ({ text }) => <p className="py-12 text-center text-sm text-content-muted">{text}</p>;

const InfoRow: React.FC<{ label: string; value: string; tone?: 'positive' | 'negative' }> = ({ label, value, tone }) => <div className="flex items-center justify-between gap-3 text-sm"><span className="text-content-muted admin-safe-wrap">{label}</span><strong className={tone === 'positive' ? 'finance-positive' : tone === 'negative' ? 'finance-negative' : 'text-content-base'}>{value}</strong></div>;

const RankRow: React.FC<{ position: number | null; title: string; subtitle: string; value: string; percentage: number; valueTone?: 'negative' }> = ({ position, title, subtitle, value, percentage, valueTone }) => <div className="p-3 rounded-xl bg-surface-base border border-border-subtle"><div className="flex items-start gap-2"><>{position !== null && <span className="w-6 h-6 rounded-full bg-gold-base/10 text-gold-base text-xs font-bold shrink-0 flex items-center justify-center">#{position}</span>}</><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold text-content-base admin-clamp-2">{title}</p><p className="mt-0.5 text-xs text-content-muted admin-clamp-2">{subtitle}</p></div><strong className={`text-sm font-mono shrink-0 ${valueTone === 'negative' ? 'finance-negative' : 'finance-positive'}`}>{value}</strong></div><div className="mt-3 h-1.5 rounded-full bg-surface-card overflow-hidden"><span className={`block h-full rounded-full ${valueTone === 'negative' ? 'bg-status-error' : 'bg-gold-base'}`} style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} /></div></div></div></div>;
