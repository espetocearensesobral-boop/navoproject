import express from 'express';
import crypto from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { receiptCreatePayloadSchema, receiptReceivePayloadSchema } from '../utils/validation.js';
import { getTodayStringBRT } from '../utils/datetime.js';
import { sendAdminPush } from '../services/admin-push.service.js';
import { awardCheckoutPointsInTransaction } from '../services/loyalty-engine.service.js';

export const receiptsRouter = express.Router();

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  cash: 'Dinheiro',
  other: 'Outro',
};

const asMoney = (value: unknown) => Number(Number(value || 0).toFixed(2));

receiptsRouter.get('/', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.query.receipts.findMany({
      orderBy: [desc(schema.receipts.createdAt)],
    });
    return res.json(rows);
  } catch (error: any) {
    return handleError(res, error, '/api/receipts');
  }
});

receiptsRouter.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const receipt = await db.query.receipts.findFirst({
      where: eq(schema.receipts.id, req.params.id),
    });
    if (!receipt) return res.status(404).json({ error: 'Recebimento não encontrado.' });
    return res.json(receipt);
  } catch (error: any) {
    return handleError(res, error, req.path);
  }
});

// Cria a conta a receber ao final do serviço. Para um atendimento já conhecido,
// a operação é idempotente: reabrir o checkout nunca duplica uma pendência.
receiptsRouter.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = receiptCreatePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados do recebimento inválidos.', details: parsed.error.flatten() });
    }

    const payload = parsed.data;
    if (payload.appointmentId) {
      const existing = await db.query.receipts.findFirst({
        where: eq(schema.receipts.appointmentId, payload.appointmentId),
      });
      if (existing) return res.status(200).json(existing);
    }

    const id = payload.id || `rcp_${crypto.randomUUID()}`;
    const [created] = await db.insert(schema.receipts).values({
      id,
      appointmentId: payload.appointmentId || null,
      clientId: payload.clientId || null,
      clientName: payload.clientName,
      clientPhone: payload.clientPhone || null,
      professionalId: payload.professionalId || null,
      professionalName: payload.professionalName || null,
      serviceTitle: payload.serviceTitle,
      originalAmount: String(asMoney(payload.originalAmount)),
      enteredAmount: String(asMoney(payload.enteredAmount)),
      observations: payload.observations || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    sendAdminPush({
      title: 'Recebimento pendente',
      body: `${created.clientName} · ${created.serviceTitle} · registre o pagamento no Financeiro.`,
      tag: `receipt:${created.id}:pending`,
      url: '/admin',
    }).catch(() => {});
    return res.status(201).json(created);
  } catch (error: any) {
    // Corrida entre duas finalizações do mesmo atendimento: devolve a pendência existente.
    if (error?.code === '23505' && req.body?.appointmentId) {
      const existing = await db.query.receipts.findFirst({
        where: eq(schema.receipts.appointmentId, req.body.appointmentId),
      });
      if (existing) return res.status(200).json(existing);
    }
    return handleError(res, error, req.path);
  }
});

// Confirma a entrada financeira e grava, na mesma transação, o lançamento que
// alimenta o Extrato Financeiro. Nenhum recebimento pendente entra no faturamento.
receiptsRouter.post('/:id/receive', requireAuth, requireAdmin, async (req, res) => {
  try {
    const parsed = receiptReceivePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados de pagamento inválidos.', details: parsed.error.flatten() });
    }
    if (typeof db.transaction !== 'function') {
      return res.status(503).json({ error: 'O banco não oferece transação para confirmar o recebimento.' });
    }

    const current = await db.query.receipts.findFirst({ where: eq(schema.receipts.id, req.params.id) });
    if (!current) return res.status(404).json({ error: 'Recebimento não encontrado.' });
    if (current.status === 'cancelled') return res.status(409).json({ error: 'Este recebimento foi cancelado.' });
    if (current.status === 'received') return res.json(current);

    const payment = parsed.data;
    const enteredAmount = asMoney(payment.enteredAmount);
    const discountAmount = asMoney(payment.discountAmount);
    const surchargeAmount = asMoney(payment.surchargeAmount);
    const expectedTotal = asMoney(Math.max(0, enteredAmount - discountAmount + surchargeAmount));
    const declaredTotal = asMoney(payment.totalAmount);

    if (Math.abs(expectedTotal - declaredTotal) > 0.01) {
      return res.status(400).json({ error: 'O total informado não confere com os ajustes aplicados.' });
    }

    const amountReceived = payment.paymentMethod === 'cash' ? asMoney(payment.amountReceived) : expectedTotal;
    if (payment.paymentMethod === 'cash' && amountReceived < expectedTotal) {
      return res.status(400).json({ error: 'O valor recebido em dinheiro deve cobrir o total do serviço.' });
    }
    const changeAmount = payment.paymentMethod === 'cash' ? asMoney(amountReceived - expectedTotal) : 0;
    const now = new Date();

    let loyaltyResult: { pointsEarned: number; tier: any; alreadyAwarded?: boolean } = { pointsEarned: 0, tier: null };
    const result = await db.transaction(async (tx: any) => {
      const [received] = await tx.update(schema.receipts)
        .set({
          enteredAmount: String(enteredAmount),
          discountPercent: String(asMoney(payment.discountPercent)),
          discountAmount: String(discountAmount),
          surchargePercent: String(asMoney(payment.surchargePercent)),
          surchargeAmount: String(surchargeAmount),
          totalAmount: String(expectedTotal),
          paymentMethod: payment.paymentMethod,
          amountReceived: String(amountReceived),
          changeAmount: String(changeAmount),
          observations: payment.observations || current.observations || null,
          status: 'received',
          receivedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.receipts.id, current.id))
        .returning();

      const ledgerId = `receipt_${current.id}`;
      await tx.insert(schema.cashTransactions).values({
        id: ledgerId,
        type: 'income',
        description: current.clientName,
        amount: String(expectedTotal),
        category: 'Recebimento de serviço',
        paymentMethod: PAYMENT_METHOD_LABEL[payment.paymentMethod] || payment.paymentMethod,
        date: getTodayStringBRT(),
        status: 'completed',
        professionalName: current.professionalName || null,
        notes: JSON.stringify({
          receiptId: current.id,
          appointmentId: current.appointmentId,
          serviceTitle: current.serviceTitle,
          originalAmount: asMoney(current.originalAmount),
          discountAmount,
          surchargeAmount,
          amountReceived,
          changeAmount,
        }),
        createdAt: now,
      }).onConflictDoNothing();

      loyaltyResult = await awardCheckoutPointsInTransaction(tx, {
        clientId: current.clientId,
        receiptId: current.id,
        amount: expectedTotal,
        description: `Pontos pelo checkout confirmado ${current.serviceTitle}`,
        now,
      });

      return received;
    });

    sendAdminPush({
      title: 'Recebimento confirmado',
      body: `${result.clientName} · ${result.serviceTitle} · R$ ${Number(result.totalAmount || 0).toFixed(2).replace('.', ',')} lançado no Extrato.`,
      tag: `receipt:${result.id}:received`,
      url: '/admin',
    }).catch(() => {});
    return res.json({
      ...result,
      loyaltyPointsAwarded: loyaltyResult.pointsEarned,
      loyaltyTier: loyaltyResult.tier?.name || null,
      loyaltyAlreadyAwarded: Boolean(loyaltyResult.alreadyAwarded),
    });
  } catch (error: any) {
    return handleError(res, error, req.path);
  }
});

receiptsRouter.patch('/:id/cancel', requireAuth, requireAdmin, async (req, res) => {
  try {
    const current = await db.query.receipts.findFirst({ where: eq(schema.receipts.id, req.params.id) });
    if (!current) return res.status(404).json({ error: 'Recebimento não encontrado.' });
    if (current.status === 'received') return res.status(409).json({ error: 'Recebimentos já confirmados não podem ser cancelados por esta ação.' });

    const [cancelled] = await db.update(schema.receipts)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(schema.receipts.id, current.id))
      .returning();
    sendAdminPush({
      title: 'Recebimento cancelado',
      body: `${cancelled.clientName} · ${cancelled.serviceTitle} · a pendência foi cancelada.`,
      tag: `receipt:${cancelled.id}:cancelled`,
      url: '/admin',
    }).catch(() => {});
    return res.json(cancelled);
  } catch (error: any) {
    return handleError(res, error, req.path);
  }
});
