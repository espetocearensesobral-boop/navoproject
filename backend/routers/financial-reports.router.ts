import express from 'express';
import { desc } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { getTodayStringBRT } from '../utils/datetime.js';

export const financialReportsRouter = express.Router();

type FinancialPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';

const isDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const asMoney = (value: unknown) => Number(Number(value || 0).toFixed(2));

const dateFromBrtString = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const toBrtDate = (value: Date | string | null | undefined) => {
  if (!value) return '';
  if (typeof value === 'string' && isDateString(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const subtractDays = (value: string, days: number) => {
  const date = dateFromBrtString(value);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const getPeriodRange = (period: FinancialPeriod) => {
  const to = getTodayStringBRT();
  const [year, month] = to.split('-');
  if (period === 'today') return { from: to, to, label: 'Hoje' };
  if (period === 'week') return { from: subtractDays(to, 6), to, label: 'Últimos 7 dias' };
  if (period === 'month') return { from: `${year}-${month}-01`, to, label: 'Mês atual' };
  if (period === 'quarter') return { from: subtractDays(to, 89), to, label: 'Últimos 90 dias' };
  return { from: `${year}-01-01`, to, label: 'Ano atual' };
};

const isInRange = (date: string, from: string, to: string) => Boolean(date && date >= from && date <= to);
const normalizePaymentMethod = (value: string | null | undefined) => {
  const normalized = String(value || 'other').toLowerCase();
  if (normalized.includes('pix')) return 'pix';
  if (normalized.includes('crédito') || normalized.includes('credit')) return 'credit_card';
  if (normalized.includes('débito') || normalized.includes('debit')) return 'debit_card';
  if (normalized.includes('dinheiro') || normalized.includes('cash')) return 'cash';
  return 'other';
};

financialReportsRouter.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rawPeriod = typeof req.query.period === 'string' ? req.query.period : 'month';
    const period: FinancialPeriod = ['today', 'week', 'month', 'quarter', 'year'].includes(rawPeriod) ? rawPeriod as FinancialPeriod : 'month';
    const range = getPeriodRange(period);

    const [transactions, receipts, professionals] = await Promise.all([
      db.query.cashTransactions.findMany({ orderBy: [desc(schema.cashTransactions.createdAt)] }),
      db.query.receipts.findMany({ orderBy: [desc(schema.receipts.createdAt)] }),
      db.query.professionals.findMany(),
    ]);

    const activeTransactions = transactions
      .filter((transaction) => transaction.status === 'completed' && isInRange(transaction.date, range.from, range.to))
      .map((transaction) => ({ ...transaction, amount: asMoney(transaction.amount) }));

    const receivedReceipts = receipts
      .filter((receipt) => receipt.status === 'received' && isInRange(toBrtDate(receipt.receivedAt), range.from, range.to))
      .map((receipt) => ({ ...receipt, totalAmount: asMoney(receipt.totalAmount) }));

    const pendingReceipts = receipts
      .filter((receipt) => receipt.status === 'pending' && isInRange(toBrtDate(receipt.createdAt), range.from, range.to))
      .map((receipt) => ({ ...receipt, totalAmount: asMoney(receipt.totalAmount) }));

    const incomeTransactions = activeTransactions.filter((transaction) => transaction.type === 'income');
    const expenseTransactions = activeTransactions.filter((transaction) => transaction.type === 'expense');
    const totalIncome = incomeTransactions.reduce((total, transaction) => total + transaction.amount, 0);
    const totalExpenses = expenseTransactions.reduce((total, transaction) => total + transaction.amount, 0);
    const serviceRevenue = receivedReceipts.reduce((total, receipt) => total + receipt.totalAmount, 0);
    const otherIncome = incomeTransactions
      .filter((transaction) => !transaction.id.startsWith('receipt_'))
      .reduce((total, transaction) => total + transaction.amount, 0);

    const serviceMap = new Map<string, { serviceTitle: string; count: number; revenue: number }>();
    const clientMap = new Map<string, { clientName: string; clientPhone: string | null; visits: number; totalSpent: number; lastReceivedAt: string | null }>();
    const professionalMap = new Map<string, { professionalName: string; servicesCount: number; revenue: number; commissionRate: number; commissionAmount: number }>();
    const paymentMap = new Map<string, { method: string; total: number; count: number }>();
    const expenseCategoryMap = new Map<string, { category: string; total: number; count: number }>();
    const dailyMap = new Map<string, { date: string; income: number; expense: number }>();

    const professionalRates = new Map<string, number>(professionals.map((professional): [string, number] => {
      const rawRate = Number(professional.commissionRate || 0);
      const rate = rawRate > 0 && rawRate <= 1 ? rawRate * 100 : rawRate;
      return [professional.name, rate];
    }));

    receivedReceipts.forEach((receipt) => {
      const service = serviceMap.get(receipt.serviceTitle) || { serviceTitle: receipt.serviceTitle, count: 0, revenue: 0 };
      service.count += 1;
      service.revenue += receipt.totalAmount;
      serviceMap.set(receipt.serviceTitle, service);

      const clientKey = receipt.clientId || receipt.clientPhone || receipt.clientName;
      const client = clientMap.get(clientKey) || { clientName: receipt.clientName, clientPhone: receipt.clientPhone || null, visits: 0, totalSpent: 0, lastReceivedAt: null };
      client.visits += 1;
      client.totalSpent += receipt.totalAmount;
      if (!client.lastReceivedAt || String(receipt.receivedAt || '') > String(client.lastReceivedAt)) client.lastReceivedAt = receipt.receivedAt?.toISOString?.() || String(receipt.receivedAt || '');
      clientMap.set(clientKey, client);

      const professionalName = receipt.professionalName || 'Não informado';
      const commissionRate = professionalRates.get(professionalName) || 0;
      const professional = professionalMap.get(professionalName) || { professionalName, servicesCount: 0, revenue: 0, commissionRate, commissionAmount: 0 };
      professional.servicesCount += 1;
      professional.revenue += receipt.totalAmount;
      professional.commissionAmount += receipt.totalAmount * (commissionRate / 100);
      professionalMap.set(professionalName, professional);

      const method = normalizePaymentMethod(receipt.paymentMethod);
      const payment = paymentMap.get(method) || { method, total: 0, count: 0 };
      payment.total += receipt.totalAmount;
      payment.count += 1;
      paymentMap.set(method, payment);
    });

    activeTransactions.forEach((transaction) => {
      const date = transaction.date;
      const day = dailyMap.get(date) || { date, income: 0, expense: 0 };
      if (transaction.type === 'income') day.income += transaction.amount;
      else day.expense += transaction.amount;
      dailyMap.set(date, day);

      if (transaction.type === 'expense') {
        const category = transaction.category || 'Sem categoria';
        const expense = expenseCategoryMap.get(category) || { category, total: 0, count: 0 };
        expense.total += transaction.amount;
        expense.count += 1;
        expenseCategoryMap.set(category, expense);
      }
    });

    const ticketAverage = receivedReceipts.length > 0 ? serviceRevenue / receivedReceipts.length : 0;
    const clients = Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
    const returningClients = clients.filter((client) => client.visits > 1).length;

    return res.json({
      period: { id: period, ...range },
      summary: {
        totalIncome: asMoney(totalIncome),
        totalExpenses: asMoney(totalExpenses),
        netResult: asMoney(totalIncome - totalExpenses),
        serviceRevenue: asMoney(serviceRevenue),
        otherIncome: asMoney(otherIncome),
        ticketAverage: asMoney(ticketAverage),
        receivedCount: receivedReceipts.length,
        pendingCount: pendingReceipts.length,
        pendingAmount: asMoney(pendingReceipts.reduce((total, receipt) => total + receipt.totalAmount, 0)),
        expenseCount: expenseTransactions.length,
        incomeCount: incomeTransactions.length,
        clientCount: clients.length,
        returningClientCount: returningClients,
        retentionRate: clients.length > 0 ? Number(((returningClients / clients.length) * 100).toFixed(1)) : 0,
      },
      services: Array.from(serviceMap.values()).map((item) => ({ ...item, revenue: asMoney(item.revenue), averageTicket: asMoney(item.revenue / item.count) })).sort((a, b) => b.revenue - a.revenue),
      clients: clients.map((item) => ({ ...item, totalSpent: asMoney(item.totalSpent) })),
      professionals: Array.from(professionalMap.values()).map((item) => ({ ...item, revenue: asMoney(item.revenue), commissionAmount: asMoney(item.commissionAmount) })).sort((a, b) => b.revenue - a.revenue),
      paymentMethods: Array.from(paymentMap.values()).map((item) => ({ ...item, total: asMoney(item.total) })).sort((a, b) => b.total - a.total),
      expenseCategories: Array.from(expenseCategoryMap.values()).map((item) => ({ ...item, total: asMoney(item.total) })).sort((a, b) => b.total - a.total),
      dailyCashFlow: Array.from(dailyMap.values()).map((item) => ({ ...item, income: asMoney(item.income), expense: asMoney(item.expense), net: asMoney(item.income - item.expense) })).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error: any) {
    return handleError(res, error, req.path);
  }
});
