import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, processAppointmentCompletion } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { queuePayloadSchema } from '../utils/validation.js';
import { sendAdminPush } from '../services/admin-push.service.js';
import { getOperationSettings } from '../services/operation-settings.service.js';

export const queueRouter = express.Router();

queueRouter.get('/', requireAuth, async (req: any, res) => {
  try {
    let dbQueue = await db.query.waitingQueue.findMany();
    if (req.user.role !== 'admin') dbQueue = dbQueue.filter((q: any) => q.clientId === req.user.id);
    dbQueue.sort((a: any, b: any) => Number(a.queuePosition || 0) - Number(b.queuePosition || 0) || new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime());
    res.json(dbQueue);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = queuePayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados da fila inválidos.', details: parsed.error.flatten() });
    const operationSettings = await getOperationSettings(db);
    const isWalkIn = !parsed.data.appointmentId;
    if (isWalkIn && !operationSettings.allowWalkIn) {
      return res.status(409).json({ error: 'Encaixes para clientes avulsos estão desativados nas configurações de Operação.' });
    }
    if (isWalkIn && operationSettings.requireProfessionalForWalkIn && !parsed.data.professionalId) {
      return res.status(400).json({ error: 'Selecione um profissional para adicionar um cliente avulso à fila.' });
    }
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `q_${crypto.randomUUID()}`;
    const queuePayload = {
      ...parsed.data,
      estimatedWaitMinutes: req.body?.estimatedWaitMinutes === undefined ? operationSettings.queueBaseWaitMinutes : parsed.data.estimatedWaitMinutes,
      arrivedAt: parsed.data.arrivedAt || new Date().toISOString(),
    };
    const [created] = await db.insert(schema.waitingQueue)
      .values({ id, joinedAt: new Date(), ...queuePayload, updatedAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (!created) return res.status(409).json({ error: 'Já existe um item com este identificador.' });
    sendAdminPush({
      title: 'Novo cliente na fila',
      body: `${created.clientName} · ${created.serviceTitle} · ${created.professionalName || 'Profissional a definir'}.`,
      tag: `queue:${created.id}:new`,
      url: '/admin',
    }).catch(() => {});
    res.status(201).json(created);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.post('/reorder', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = z.object({ orderedIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ordem da fila inválida.' });
    const orderedIds = [...new Set(parsed.data.orderedIds)];
    if (typeof db.transaction !== 'function') return res.status(503).json({ error: 'O banco não oferece transação para reordenar a fila com segurança.' });

    await db.transaction(async (tx: any) => {
      const rows = await tx.query.waitingQueue.findMany();
      const waitingIds = new Set(rows.filter((row: any) => row.status === 'waiting').map((row: any) => row.id));
      if (orderedIds.some((id) => !waitingIds.has(id))) throw new Error('QUEUE_ORDER_INVALID');
      for (let index = 0; index < orderedIds.length; index += 1) {
        await tx.update(schema.waitingQueue)
          .set({ queuePosition: index, updatedAt: new Date() })
          .where(eq(schema.waitingQueue.id, orderedIds[index]));
      }
    });
    return res.json({ success: true });
  } catch (error: any) {
    if (error?.message === 'QUEUE_ORDER_INVALID') return res.status(400).json({ error: 'A ordem contém registros que não estão aguardando na fila.' });
    return handleError(res, error, req.path);
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
    const currentStatus = currentQueueItem.status;
    const transitionMap: Record<string, string[]> = {
      waiting: ['waiting', 'in_chair', 'abandoned', 'cancelled'],
      in_chair: ['in_chair', 'waiting', 'completed', 'cancelled'],
      abandoned: ['abandoned', 'waiting', 'cancelled'],
      completed: ['completed'],
      cancelled: ['cancelled'],
    };
    if (nextStatus && !((transitionMap[currentStatus] || []).includes(nextStatus))) {
      return res.status(409).json({ error: `Transição inválida: ${currentStatus} → ${nextStatus}.` });
    }
    const appointmentStatus = nextStatus === 'completed'
      ? 'completed'
      : nextStatus === 'in_chair'
      ? 'in_service'
      : nextStatus === 'waiting'
      ? 'in_queue'
      : nextStatus === 'abandoned'
      ? 'confirmed'
      : nextStatus === 'cancelled'
      ? 'cancelled'
      : undefined;

    const { startedAt: _startedAt, completedAt: _completedAt, ...safeParsedData } = parsed.data;
    const timestamp = new Date();
    const queueUpdate: any = { ...safeParsedData, updatedAt: timestamp };
    if (nextStatus === 'in_chair' && !currentQueueItem.startedAt) queueUpdate.startedAt = timestamp.toISOString();
    if (nextStatus === 'completed' && !currentQueueItem.completedAt) queueUpdate.completedAt = timestamp.toISOString();
    let updatedQueue: any;
    let updatedAppointment: any = null;
    let completionStage = 'before_transaction';

    if (currentQueueItem.appointmentId && appointmentStatus) {
      if (typeof db.transaction !== 'function') {
        return res.status(503).json({ error: 'O banco não oferece transação para sincronizar Fila e Agenda.' });
      }

      try {
        completionStage = 'appointment_update';
        await db.transaction(async (tx: any) => {
          const [savedAppointment] = await tx.update(schema.appointments)
          .set({ status: appointmentStatus, updatedAt: new Date() })
          .where(eq(schema.appointments.id, currentQueueItem.appointmentId))
          .returning();
        if (!savedAppointment) throw new Error('APPOINTMENT_NOT_FOUND');
        updatedAppointment = savedAppointment;

        completionStage = 'queue_update';
        const [savedQueue] = await tx.update(schema.waitingQueue)
          .set(queueUpdate)
          .where(eq(schema.waitingQueue.id, req.params.id))
          .returning();
        if (!savedQueue) throw new Error('QUEUE_ITEM_NOT_FOUND');
        updatedQueue = savedQueue;
        });
      } catch (error: any) {
        error.completionStage = completionStage;
        throw error;
      }

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

    if (nextStatus && currentQueueItem.status !== nextStatus) {
      const statusCopy: Record<string, { title: string; body: string }> = {
        waiting: { title: 'Cliente na recepção', body: 'Um cliente está aguardando atendimento.' },
        in_chair: { title: 'Cliente chamado para cadeira', body: 'Um atendimento entrou em andamento.' },
        completed: { title: 'Atendimento concluído', body: 'Um corte foi finalizado na operação.' },
        cancelled: { title: 'Operação cancelada', body: 'Um cliente foi cancelado na Fila de Espera.' },
        abandoned: { title: 'Cliente removido da fila', body: 'Um cliente saiu temporariamente da recepção.' },
      };
      const copy = statusCopy[nextStatus];
      if (copy) {
        sendAdminPush({
          title: copy.title,
          body: `${updatedQueue.clientName} · ${updatedQueue.serviceTitle} · ${copy.body}`,
          tag: `queue:${updatedQueue.appointmentId || updatedQueue.id}:${nextStatus}`,
          url: '/admin',
        }).catch(() => {});
      }
    }
    res.json(updatedQueue);
  } catch (e: any) {
    if (e?.message === 'APPOINTMENT_NOT_FOUND') {
      return res.status(409).json({ error: 'O agendamento associado não foi encontrado para sincronização.' });
    }
    if (e?.message === 'QUEUE_ITEM_NOT_FOUND') {
      return res.status(404).json({ error: 'Item da fila não encontrado.' });
    }
    const rootDbError = e?.cause?.cause || e?.cause || e;
    const pgCode = e?.code || e?.cause?.code || e?.cause?.cause?.code;
    const pgConstraint = rootDbError?.constraint || rootDbError?.constraint_name || null;
    const diagnosticStage = e?.completionStage || 'before_transaction';
    const diagnosticDetails = {
      code: pgCode || null,
      constraint: pgConstraint,
      errorType: rootDbError?.name || e?.name || null
    };
    if (pgCode === '23514' || pgCode === '42804') {
      return res.status(409).json({
        error: 'A estrutura do status de agendamento está desatualizada. Aplique a migração 0011 e tente novamente.',
        diagnosticCode: `QUEUE_${String(diagnosticStage).toUpperCase()}`,
        diagnosticDetails
      });
    }
    console.error('[API] Queue completion failed:', { stage: diagnosticStage, code: pgCode || 'unknown', error: e });
    return res.status(500).json({
      error: 'Não foi possível concluir a solicitação. Tente novamente mais tarde.',
      diagnosticCode: `QUEUE_${String(diagnosticStage).toUpperCase()}`,
      diagnosticDetails
    });
  }
});

queueRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const currentQueueItem = await db.query.waitingQueue.findFirst({
      where: eq(schema.waitingQueue.id, req.params.id),
    });
    if (!currentQueueItem) return res.status(404).json({ error: 'Item da fila não encontrado.' });

    if (currentQueueItem.appointmentId) {
      return res.status(409).json({ error: 'Agendamentos vinculados não podem ser excluídos. Use retornar ou cancelar atendimento.' });
    }
    if (currentQueueItem.status !== 'abandoned') {
      return res.status(409).json({ error: 'Somente registros avulsos removidos podem ser excluídos.' });
    }

    const deleted = await db.delete(schema.waitingQueue)
      .where(eq(schema.waitingQueue.id, req.params.id))
      .returning({ id: schema.waitingQueue.id });
    if (deleted.length === 0) return res.status(404).json({ error: 'Item da fila não encontrado.' });
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
