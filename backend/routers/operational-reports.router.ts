import express from 'express';
import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { getCurrentTimeBRT, getTodayStringBRT, timeToMinutes } from '../utils/datetime.js';
import { getOperationSettings } from '../services/operation-settings.service.js';
import { isConfirmedCheckoutIncome, isFinancialLedgerTransaction, receiptIdFromLedgerTransaction } from '../utils/financial.js';

export const operationalReportsRouter = express.Router();

type OperationalPeriod = 'today' | 'week' | 'month' | 'quarter';

type ServiceAggregate = { serviceTitle: string; count: number; completedCount: number; revenue: number };
type ProfessionalAggregate = { professionalName: string; appointments: number; completed: number; revenue: number };
type DayAggregate = { date: string; label: string; appointments: number; completed: number; cancelled: number; revenue: number };

const asMoney = (value: unknown) => Number(Number(value || 0).toFixed(2));
const isDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const dateFromBrtString = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const subtractDays = (value: string, days: number) => {
  const date = dateFromBrtString(value);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const getOperationalToday = (dayStartTime: string) => {
  const today = getTodayStringBRT();
  return getCurrentTimeBRT().totalMinutes < timeToMinutes(dayStartTime) ? subtractDays(today, 1) : today;
};

const getRange = (period: OperationalPeriod, operationalToday: string) => {
  const to = operationalToday;
  if (period === 'today') return { from: to, to, label: 'Hoje operacional', days: 1 };
  if (period === 'week') return { from: subtractDays(to, 6), to, label: 'Últimos 7 dias', days: 7 };
  if (period === 'quarter') return { from: subtractDays(to, 89), to, label: 'Últimos 90 dias', days: 90 };
  return { from: subtractDays(to, 29), to, label: 'Últimos 30 dias', days: 30 };
};

const inRange = (date: string | null | undefined, from: string, to: string) => Boolean(date && date >= from && date <= to);
const normalizeHour = (value: string | null | undefined) => {
  const match = String(value || '').match(/^(\d{1,2})/);
  return match ? `${String(Number(match[1])).padStart(2, '0')}:00` : null;
};
const normalizeServiceTitle = (value: any) => {
  if (typeof value === 'string') return value.trim();
  return String(value?.title || value?.name || value?.serviceTitle || value?.service_title || '').trim();
};
const weekdayIndex = (date: string) => dateFromBrtString(date).getUTCDay();
const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const hourToLabel = (hour: string) => `${Number(hour.slice(0, 2))}h`;

operationalReportsRouter.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rawPeriod = typeof req.query.period === 'string' ? req.query.period : 'week';
    const period: OperationalPeriod = ['today', 'week', 'month', 'quarter'].includes(rawPeriod) ? rawPeriod as OperationalPeriod : 'week';
    const operationSettings = await getOperationSettings(db);
    const today = getOperationalToday(operationSettings.reportsDayStartTime);
    const range = getRange(period, today);
    const previousRange = operationSettings.reportsComparisonWindow === 'previous_period'
      ? { from: subtractDays(range.from, range.days), to: subtractDays(range.from, 1) }
      : null;
    const queryFrom = previousRange?.from || range.from;

    const [appointments, queue, receipts, cashTransactions] = await Promise.all([
      db.query.appointments.findMany({ where: and(gte(schema.appointments.date, queryFrom), lte(schema.appointments.date, range.to)), orderBy: [desc(schema.appointments.createdAt)] }),
      db.query.waitingQueue.findMany({ orderBy: [desc(schema.waitingQueue.joinedAt)] }),
      db.query.receipts.findMany({ orderBy: [desc(schema.receipts.createdAt)] }),
      db.query.cashTransactions.findMany({ where: and(gte(schema.cashTransactions.date, queryFrom), lte(schema.cashTransactions.date, range.to)), orderBy: [desc(schema.cashTransactions.createdAt)] }),
    ]);

    const periodAppointments = appointments.filter((appointment) => inRange(appointment.date, range.from, range.to));
    const countableAppointments = periodAppointments.filter((appointment) => (
      (operationSettings.reportsIncludeCancelled || appointment.status !== 'cancelled') &&
      (operationSettings.reportsIncludeNoShow || appointment.status !== 'no_show')
    ));
    const activeAppointments = countableAppointments.filter((appointment) => !['cancelled', 'no_show'].includes(appointment.status));
    const completedAppointments = countableAppointments.filter((appointment) => appointment.status === 'completed');
    const cancelledAppointments = periodAppointments.filter((appointment) => appointment.status === 'cancelled');
    const noShowAppointments = periodAppointments.filter((appointment) => appointment.status === 'no_show');
    const todayAppointments = appointments.filter((appointment) => appointment.date === today && (
      (operationSettings.reportsIncludeCancelled || appointment.status !== 'cancelled') &&
      (operationSettings.reportsIncludeNoShow || appointment.status !== 'no_show')
    ));
    const todayActiveAppointments = todayAppointments.filter((appointment) => !['cancelled', 'completed', 'no_show'].includes(appointment.status));

    const periodCashTransactions = cashTransactions.filter((transaction) => transaction.status === 'completed' && isFinancialLedgerTransaction(transaction) && inRange(transaction.date, range.from, range.to));
    const periodIncome = periodCashTransactions.filter((transaction) => isConfirmedCheckoutIncome(transaction)).reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const periodExpenses = periodCashTransactions.filter((transaction) => transaction.type === 'expense').reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const confirmedCheckoutReceiptIds = new Set(
      cashTransactions.filter((transaction) => transaction.status === 'completed' && isConfirmedCheckoutIncome(transaction)).map((transaction) => receiptIdFromLedgerTransaction(transaction.id)).filter(Boolean),
    );
    const receivedReceipts = receipts.filter((receipt) => receipt.status === 'received' && confirmedCheckoutReceiptIds.has(receipt.id));
    const periodReceivedReceipts = receivedReceipts.filter((receipt) => inRange(appointmentDate(receipt.appointmentId, appointments), range.from, range.to) || inRange(toBrtDate(receipt.receivedAt), range.from, range.to));
    const receiptByAppointment = new Map<string, any>(periodReceivedReceipts.filter((receipt) => receipt.appointmentId).map((receipt): [string, any] => [receipt.appointmentId as string, receipt]));
    const periodServiceRevenue = periodReceivedReceipts.reduce((total, receipt) => total + Number(receipt.totalAmount || 0), 0);

    const serviceMap = new Map<string, ServiceAggregate>();
    const professionalMap = new Map<string, ProfessionalAggregate>();
    const hourMap = new Map<string, number>();
    const dailyMap = new Map<string, DayAggregate>();
    const weeklyMap = new Map<number, { weekday: number; label: string; appointments: number; completed: number; revenue: number }>();

    for (const offset of Array.from({ length: range.days }, (_, index) => index).reverse()) {
      const date = subtractDays(range.to, offset);
      dailyMap.set(date, { date, label: `${date.slice(8, 10)}/${date.slice(5, 7)}`, appointments: 0, completed: 0, cancelled: 0, revenue: 0 });
    }
    for (let index = 0; index < 7; index += 1) weeklyMap.set(index, { weekday: index, label: weekdayLabels[index], appointments: 0, completed: 0, revenue: 0 });

    for (const appointment of countableAppointments) {
      const day = dailyMap.get(appointment.date) || { date: appointment.date, label: `${appointment.date.slice(8, 10)}/${appointment.date.slice(5, 7)}`, appointments: 0, completed: 0, cancelled: 0, revenue: 0 };
      day.appointments += 1;
      if (appointment.status === 'completed') day.completed += 1;
      if (appointment.status === 'cancelled') day.cancelled += 1;

      const receipt = receiptByAppointment.get(appointment.id);
      const receivedAmount = receipt ? Number(receipt.totalAmount || 0) : 0;
      day.revenue += receivedAmount;
      dailyMap.set(appointment.date, day);

      const weekday = weekdayIndex(appointment.date);
      const weekDay = weeklyMap.get(weekday)!;
      weekDay.appointments += 1;
      if (appointment.status === 'completed') weekDay.completed += 1;
      weekDay.revenue += receivedAmount;

      if (appointment.status !== 'cancelled') {
        const hour = normalizeHour(appointment.timeSlot);
        if (hour) hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      }

      const professionalName = appointment.professionalName || 'Não informado';
      const professional = professionalMap.get(professionalName) || { professionalName, appointments: 0, completed: 0, revenue: 0 };
      professional.appointments += 1;
      if (appointment.status === 'completed') professional.completed += 1;
      professional.revenue += receivedAmount;
      professionalMap.set(professionalName, professional);

      const rawServices = Array.isArray(appointment.services) ? appointment.services : [];
      const serviceTitles = rawServices.map(normalizeServiceTitle).filter(Boolean);
      const fallbackTitle = serviceTitles.length === 0 ? 'Serviço não informado' : '';
      const titles = serviceTitles.length > 0 ? serviceTitles : [fallbackTitle];
      const revenuePerService = receivedAmount / titles.length;
      for (const serviceTitle of titles) {
        const service = serviceMap.get(serviceTitle) || { serviceTitle, count: 0, completedCount: 0, revenue: 0 };
        service.count += 1;
        if (appointment.status === 'completed') service.completedCount += 1;
        service.revenue += revenuePerService;
        serviceMap.set(serviceTitle, service);
      }
    }

    const currentQueue = queue.filter((item) => ['waiting', 'in_chair'].includes(item.status));
    const periodQueue = queue.filter((item) => inRange(toBrtDate(item.joinedAt), range.from, range.to));
    const queueSummary = ['waiting', 'in_chair', 'completed', 'abandoned', 'cancelled'].map((status) => ({
      status,
      count: periodQueue.filter((item) => item.status === status).length,
    }));

    const pendingReceipts = operationSettings.reportsShowPendingValues ? receipts.filter((receipt) => receipt.status === 'pending') : [];
    const upcomingAppointments = todayActiveAppointments
      .sort((a, b) => String(a.timeSlot).localeCompare(String(b.timeSlot)))
      .slice(0, 8)
      .map((appointment) => ({
        id: appointment.id,
        clientName: appointment.clientName,
        professionalName: appointment.professionalName,
        serviceTitle: normalizeServiceTitle(Array.isArray(appointment.services) ? appointment.services[0] : '') || 'Serviço',
        timeSlot: appointment.timeSlot,
        status: appointment.status,
        finalAmount: asMoney(appointment.finalAmount),
      }));

    const topHours = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, label: hourToLabel(hour), count }))
      .sort((a, b) => b.count - a.count || a.hour.localeCompare(b.hour))
      .slice(0, 5);
    const peakHour = topHours[0] || null;
    const topServices = Array.from(serviceMap.values())
      .map((service) => ({ ...service, revenue: asMoney(service.revenue) }))
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 5);
    const topProfessionals = Array.from(professionalMap.values())
      .map((professional) => ({ ...professional, revenue: asMoney(professional.revenue) }))
      .sort((a, b) => b.completed - a.completed || b.revenue - a.revenue)
      .slice(0, 5);

    const averageTicket = periodReceivedReceipts.length > 0 ? periodServiceRevenue / periodReceivedReceipts.length : 0;
    const completionRate = activeAppointments.length > 0 ? (completedAppointments.length / activeAppointments.length) * 100 : 0;
    const cancellationRate = periodAppointments.length > 0 ? (cancelledAppointments.length / periodAppointments.length) * 100 : 0;

    const comparison = previousRange ? (() => {
      const previousAppointments = appointments.filter((appointment) => inRange(appointment.date, previousRange.from, previousRange.to));
      const previousCountable = previousAppointments.filter((appointment) => (
        (operationSettings.reportsIncludeCancelled || appointment.status !== 'cancelled') &&
        (operationSettings.reportsIncludeNoShow || appointment.status !== 'no_show')
      ));
      const previousCompleted = previousCountable.filter((appointment) => appointment.status === 'completed').length;
      const previousCash = cashTransactions.filter((transaction) => transaction.status === 'completed' && isFinancialLedgerTransaction(transaction) && inRange(transaction.date, previousRange.from, previousRange.to));
      const previousIncome = previousCash.filter((transaction) => isConfirmedCheckoutIncome(transaction)).reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
      const previousExpenses = previousCash.filter((transaction) => transaction.type === 'expense').reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
      const previousReceived = receipts.filter((receipt) => receipt.status === 'received' && confirmedCheckoutReceiptIds.has(receipt.id) && inRange(toBrtDate(receipt.receivedAt), previousRange.from, previousRange.to));
      const previousServiceRevenue = previousReceived.reduce((total, receipt) => total + Number(receipt.totalAmount || 0), 0);
      return {
        from: previousRange.from,
        to: previousRange.to,
        appointments: previousAppointments.length,
        completedAppointments: previousCompleted,
        serviceRevenue: asMoney(previousServiceRevenue),
        totalIncome: asMoney(previousIncome),
        totalExpenses: asMoney(previousExpenses),
        netResult: asMoney(previousIncome - previousExpenses),
        averageTicket: asMoney(previousReceived.length > 0 ? previousServiceRevenue / previousReceived.length : 0),
      };
    })() : null;

    return res.json({
      period: { id: period, ...range },
      summary: {
        appointments: countableAppointments.length,
        activeAppointments: activeAppointments.length,
        completedAppointments: completedAppointments.length,
        cancelledAppointments: cancelledAppointments.length,
        noShowAppointments: noShowAppointments.length,
        completionRate: Number(completionRate.toFixed(1)),
        cancellationRate: Number(cancellationRate.toFixed(1)),
        todayAppointments: todayAppointments.length,
        todayActiveAppointments: todayActiveAppointments.length,
        currentQueue: currentQueue.length,
        currentWaiting: currentQueue.filter((item) => item.status === 'waiting').length,
        currentInChair: currentQueue.filter((item) => item.status === 'in_chair').length,
        pendingReceipts: pendingReceipts.length,
        pendingAmount: asMoney(pendingReceipts.reduce((total, receipt) => total + Number(receipt.totalAmount || 0), 0)),
        serviceRevenue: asMoney(periodServiceRevenue),
        otherIncome: asMoney(Math.max(0, periodIncome - periodServiceRevenue)),
        totalIncome: asMoney(periodIncome),
        totalExpenses: asMoney(periodExpenses),
        netResult: asMoney(periodIncome - periodExpenses),
        averageTicket: asMoney(averageTicket),
        operationalDay: today,
      },
      comparison,
      settings: {
        dayStartTime: operationSettings.reportsDayStartTime,
        includeCancelled: operationSettings.reportsIncludeCancelled,
        includeNoShow: operationSettings.reportsIncludeNoShow,
        showPendingValues: operationSettings.reportsShowPendingValues,
        refreshSeconds: operationSettings.reportsRefreshSeconds,
      },
      peakHour,
      topHours,
      topServices,
      topProfessionals,
      weeklyMovement: Array.from(weeklyMap.values()),
      dailyMovement: Array.from(dailyMap.values()).map((day) => ({ ...day, revenue: asMoney(day.revenue) })),
      queueSummary,
      upcomingAppointments,
    });
  } catch (error: any) {
    return handleError(res, error, req.path);
  }
});

const appointmentDate = (appointmentId: string | null, appointments: any[]) => {
  if (!appointmentId) return '';
  return appointments.find((appointment) => appointment.id === appointmentId)?.date || '';
};

const toBrtDate = (value: Date | string | null | undefined) => {
  if (!value) return '';
  if (typeof value === 'string' && isDateString(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
