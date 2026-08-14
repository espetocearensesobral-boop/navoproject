import express from 'express';
import { desc } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { getTodayStringBRT } from '../utils/datetime.js';

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

const getRange = (period: OperationalPeriod) => {
  const to = getTodayStringBRT();
  if (period === 'today') return { from: to, to, label: 'Hoje', days: 1 };
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
    const range = getRange(period);
    const today = getTodayStringBRT();

    const [appointments, queue, receipts, cashTransactions] = await Promise.all([
      db.query.appointments.findMany({ orderBy: [desc(schema.appointments.createdAt)] }),
      db.query.waitingQueue.findMany({ orderBy: [desc(schema.waitingQueue.joinedAt)] }),
      db.query.receipts.findMany({ orderBy: [desc(schema.receipts.createdAt)] }),
      db.query.cashTransactions.findMany({ orderBy: [desc(schema.cashTransactions.createdAt)] }),
    ]);

    const periodAppointments = appointments.filter((appointment) => inRange(appointment.date, range.from, range.to));
    const activeAppointments = periodAppointments.filter((appointment) => appointment.status !== 'cancelled');
    const completedAppointments = periodAppointments.filter((appointment) => appointment.status === 'completed');
    const cancelledAppointments = periodAppointments.filter((appointment) => appointment.status === 'cancelled');
    const noShowAppointments = periodAppointments.filter((appointment) => appointment.status === 'no_show');
    const todayAppointments = appointments.filter((appointment) => appointment.date === today);
    const todayActiveAppointments = todayAppointments.filter((appointment) => !['cancelled', 'completed'].includes(appointment.status));

    const receivedReceipts = receipts.filter((receipt) => receipt.status === 'received');
    const receiptByAppointment = new Map<string, any>(receivedReceipts.filter((receipt) => receipt.appointmentId).map((receipt): [string, any] => [receipt.appointmentId as string, receipt]));
    const periodReceivedReceipts = receivedReceipts.filter((receipt) => inRange(appointmentDate(receipt.appointmentId, appointments), range.from, range.to) || inRange(toBrtDate(receipt.receivedAt), range.from, range.to));
    const periodServiceRevenue = periodReceivedReceipts.reduce((total, receipt) => total + Number(receipt.totalAmount || 0), 0);

    const periodCashTransactions = cashTransactions.filter((transaction) => transaction.status === 'completed' && inRange(transaction.date, range.from, range.to));
    const periodIncome = periodCashTransactions.filter((transaction) => transaction.type === 'income').reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const periodExpenses = periodCashTransactions.filter((transaction) => transaction.type === 'expense').reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

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

    for (const appointment of periodAppointments) {
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

    const pendingReceipts = receipts.filter((receipt) => receipt.status === 'pending');
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

    return res.json({
      period: { id: period, ...range },
      summary: {
        appointments: periodAppointments.length,
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
