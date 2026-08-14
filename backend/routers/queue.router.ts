import express from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, processAppointmentCompletion } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { queuePayloadSchema } from '../utils/validation.js';

export const queueRouter = express.Router();

queueRouter.get('/', requireAuth, async (req: any, res) => {
  try {
    let dbQueue = await db.query.waitingQueue.findMany();
    if (req.user.role !== 'admin') dbQueue = dbQueue.filter((q: any) => q.clientId === req.user.id);
    res.json(dbQueue);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = queuePayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados da fila inválidos.', details: parsed.error.flatten() });
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `q_${crypto.randomUUID()}`;
    const [created] = await db.insert(schema.waitingQueue)
      .values({ id, joinedAt: new Date(), ...parsed.data, updatedAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (!created) return res.status(409).json({ error: 'Já existe um item com este identificador.' });
    res.status(201).json(created);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.put('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = queuePayloadSchema.omit({ id: true }).partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados da fila inválidos.', details: parsed.error.flatten() });

    const currentQueueItem = await db.query.waitingQueue.findFirst({
      where: eq(schema.waitingQueue.id, req.params.id),
    });
    if (!currentQueueItem) return res.status(404).json({ error: 'Item da fila não encontrado.' });

    const nextStatus = parsed.data.status;
    const appointmentStatus = nextStatus === 'completed'
      ? 'completed'
      : nextStatus === 'in_chair'
      ? 'in_service'
      : nextStatus === 'waiting'
      ? 'in_queue'
      : undefined;

    const queueUpdate = { ...parsed.data, updatedAt: new Date() };
    let updatedQueue: any;
    let updatedAppointment: any = null;

    if (currentQueueItem.appointmentId && appointmentStatus) {
      if (typeof db.transaction !== 'function') {
        return res.status(503).json({ error: 'O banco não oferece transação para sincronizar Fila e Agenda.' });
      }

      await db.transaction(async (tx: any) => {
        const [savedAppointment] = await tx.update(schema.appointments)
          .set({ status: appointmentStatus, updatedAt: new Date() })
          .where(eq(schema.appointments.id, currentQueueItem.appointmentId))
          .returning();
        if (!savedAppointment) throw new Error('APPOINTMENT_NOT_FOUND');
        updatedAppointment = savedAppointment;

        const [savedQueue] = await tx.update(schema.waitingQueue)
          .set(queueUpdate)
          .where(eq(schema.waitingQueue.id, req.params.id))
          .returning();
        if (!savedQueue) throw new Error('QUEUE_ITEM_NOT_FOUND');
        updatedQueue = savedQueue;
      });

      if (appointmentStatus === 'completed') {
        await processAppointmentCompletion(updatedAppointment);
      }
    } else {
      const [savedQueue] = await db.update(schema.waitingQueue)
        .set(queueUpdate)
        .where(eq(schema.waitingQueue.id, req.params.id))
        .returning();
      if (!savedQueue) return res.status(404).json({ error: 'Item da fila não encontrado.' });
      updatedQueue = savedQueue;
    }

    res.json(updatedQueue);
  } catch (e: any) {
    if (e?.message === 'APPOINTMENT_NOT_FOUND') {
      return res.status(409).json({ error: 'O agendamento associado não foi encontrado para sincronização.' });
    }
    if (e?.message === 'QUEUE_ITEM_NOT_FOUND') {
      return res.status(404).json({ error: 'Item da fila não encontrado.' });
    }
    const pgCode = e?.code || e?.cause?.code;
    if (pgCode === '23514') {
      return res.status(409).json({
        error: 'O banco rejeitou o status do atendimento. Aplique a migração de integridade mais recente e tente novamente.'
      });
    }
    return handleError(res, e, req.path);
  }
});

queueRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await db.delete(schema.waitingQueue).where(eq(schema.waitingQueue.id, req.params.id)).returning({ id: schema.waitingQueue.id });
    if (deleted.length === 0) return res.status(404).json({ error: 'Item da fila não encontrado.' });
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
