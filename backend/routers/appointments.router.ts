import express from 'express';
import { eq, or, and, sql, desc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin, optionalAuth, authLimiter, sensitiveOpsLimiter, apiLimiter, setAuthCookie } from '../middleware/index.js';
import { handleError, userErrors, sanitizePhone, matchPhoneNumbers, generateBookingCode, bookingSchema } from '../utils/index.js';
import { timeToMinutes, minutesToTime, getDayOfWeekKey, getTodayStringBRT, getCurrentTimeBRT } from '../utils/datetime.js';
import { dateSchema, timeSchema } from '../utils/validation.js';
import { JWT_SECRET } from '../config/env.js';
import { checkSlotAvailability } from '../services/availability.service.js';
import { invalidateAvailabilityCache } from './availability.router.js';



import { processAppointmentCompletion, notifyClientByEmail, notifyShopByEmail } from '../index.js';
import { sendWhatsAppMessage } from '../whatsapp.js';
import { sendAdminPush } from '../services/admin-push.service.js';

export const appointmentsRouter = express.Router();

// =====================================
// Guest Appointments Lookup API (2 Etapas)
// =====================================

// GET /api/appointments/lookup/step1 — Verifica se há agendamentos ativos para o telefone
appointmentsRouter.get("/lookup/step1", sensitiveOpsLimiter, async (req: any, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: userErrors.dbDisconnected });
    }
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Informe o telefone.' });
    }

    const inputPhone = phone.toString().trim();
    const digitsOnly = inputPhone.replace(/\D/g, '');

    if (!digitsOnly || digitsOnly.length < 8) {
      return res.status(400).json({ error: 'Telefone inválido. Digite DDD + número.' });
    }

    const allApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);

    const appointments = allApts.filter((apt: any) => 
      apt.status !== 'cancelled' && matchPhoneNumbers(apt.clientPhone, inputPhone)
    );

    if (!appointments || appointments.length === 0) {
      return res.status(404).json({ 
        error: 'Nenhum agendamento encontrado para este telefone.',
        requiresCode: false
      });
    }

    return res.json({
      success: true,
      requiresCode: true,
      count: appointments.length,
      message: appointments.length === 1 
        ? 'Encontramos 1 agendamento. Digite o código da reserva para acessar.'
        : `Encontramos ${appointments.length} agendamentos. Digite o código da reserva para acessar.`
    });

  } catch (e: any) {
    return handleError(res, e, 'GET /api/appointments/lookup/step1');
  }
});

// POST /api/appointments/lookup/verify — Valida código e gera sessão (cookie HTTP-only)
appointmentsRouter.post("/lookup/verify", sensitiveOpsLimiter, async (req: any, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: userErrors.dbDisconnected });
    }
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Informe telefone e código.' });
    }
    const inputPhone = phone.toString().trim();
    const cleanCode = code.toString().toUpperCase().trim();
    
    const allApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);
      
    const candidates = allApts.filter((apt: any) => matchPhoneNumbers(apt.clientPhone, inputPhone));
    
    const matchedApt = candidates.find((apt: any) => {
      const aptCode = (apt.bookingCode || apt.id || '').toUpperCase();
      return aptCode === cleanCode;
    });

    if (!matchedApt) {
      return res.status(401).json({ error: 'Código de confirmação incorreto para o telefone informado.' });
    }

    const token = jwt.sign(
      { role: 'guest_auth', phone: inputPhone, appointmentId: matchedApt.id, id: `guest_${Date.now()}` },
      JWT_SECRET,
      { expiresIn: '30m' } // Reduzido de 1h para 30m
    );

    res.cookie('guest_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000 // 30 minutos (em milissegundos)
    });

    return res.json({ success: true, message: 'Validado com sucesso.' });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/appointments/lookup/verify');
  }
});

// POST /api/appointments/lookup/logout — Revoga a sessão de visitante
appointmentsRouter.post("/lookup/logout", (req: any, res) => {
  res.clearCookie('guest_token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return res.status(200).json({ success: true });
});

// GET /api/appointments/lookup/step2 — Valida código e retorna detalhes do agendamento
appointmentsRouter.get("/lookup/step2", optionalAuth, async (req: any, res) => {
  try {
    const { phone, code } = req.query;

    if (!phone || !code) {
      return res.status(400).json({ 
        error: 'Informe o telefone e o código da reserva.' 
      });
    }

    const inputPhone = phone.toString().trim();
    const cleanCode = code.toString().toUpperCase().trim();

    // Secure checking: Verify authorization
    let isAuthorized = false;
    const isAdmin = req.user?.role === 'admin';
    let userPhone = req.user?.phone;
    if (!userPhone && req.user?.id && req.user.id !== 'usr_guest') {
      const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
      if (dbUser) userPhone = dbUser.phone;
    }

    if (isAdmin) {
      isAuthorized = true;
    } else if (userPhone && matchPhoneNumbers(userPhone, inputPhone)) {
      isAuthorized = true;
    } else if (req.cookies?.guest_token) {
      try {
        const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
        if (guestDecoded.phone && matchPhoneNumbers(guestDecoded.phone, inputPhone)) {
          // Extra security: ensure the guest token is bound to this specific appointment
          // We will verify this further down when we find the appointment
          req.user = { ...req.user, guestAppointmentId: guestDecoded.appointmentId };
          isAuthorized = true;
        }
      } catch (e) {
        // Token inválido ou expirado
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Acesso negado: Sessão de busca inválida ou expirada.' });
    }

    const allApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);

    const candidates = allApts.filter((apt: any) => 
      matchPhoneNumbers(apt.clientPhone, inputPhone)
    );

    const appointment = candidates.find((apt: any) => {
      const aptCode = (apt.bookingCode || apt.id || '').toUpperCase();
      return aptCode === cleanCode;
    });

    // Validar também o vínculo exato do token com o agendamento
    if (appointment && !isAdmin && req.cookies?.guest_token) {
      if (req.user?.guestAppointmentId && req.user.guestAppointmentId !== appointment.id) {
        return res.status(403).json({ error: 'Acesso negado: Sessão não autorizada para este agendamento.' });
      }
    }

    if (!appointment) {
      return res.status(404).json({ 
        error: 'Código de reserva inválido. Verifique e tente novamente.' 
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ 
        error: 'Este agendamento já foi cancelado.' 
      });
    }

    return res.json({
      success: true,
      appointment: {
        id: appointment.id,
        bookingCode: appointment.bookingCode || appointment.id,
        clientName: appointment.clientName,
        date: appointment.date,
        timeSlot: appointment.timeSlot,
        professionalName: appointment.professionalName,
        status: appointment.status,
        services: appointment.services,
        finalAmount: appointment.finalAmount,
        paymentMethod: appointment.paymentMethod,
      }
    });

  } catch (e: any) {
    console.error('[API] Erro em lookup/step2:', e);
    return res.status(500).json({ error: 'Erro ao buscar reserva. Tente novamente.' });
  }
});

// PATCH /api/appointments/lookup/cancel — Cancela agendamento via telefone + código
appointmentsRouter.patch("/lookup/cancel", sensitiveOpsLimiter, optionalAuth, async (req: any, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Informe telefone e código da reserva.' });
    }

    const inputPhone = phone.toString().trim();
    const cleanCode = code.toString().toUpperCase().trim();

    // Secure checking: Verify authorization
    let isAuthorized = false;
    const isAdmin = req.user?.role === 'admin';
    let userPhone = req.user?.phone;
    if (!userPhone && req.user?.id && req.user.id !== 'usr_guest') {
      const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
      if (dbUser) userPhone = dbUser.phone;
    }

    if (isAdmin) {
      isAuthorized = true;
    } else if (userPhone && matchPhoneNumbers(userPhone, inputPhone)) {
      isAuthorized = true;
    } else if (req.cookies?.guest_token) {
      try {
        const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
        if (guestDecoded.phone && matchPhoneNumbers(guestDecoded.phone, inputPhone)) {
          // Extra security: ensure the guest token is bound to this specific appointment
          // We will verify this further down when we find the appointment
          req.user = { ...req.user, guestAppointmentId: guestDecoded.appointmentId };
          isAuthorized = true;
        }
      } catch (e) {
        // Token inválido ou expirado
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Acesso negado: Sessão de busca inválida ou expirada.' });
    }

    const allApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);

    const candidates = allApts.filter((apt: any) => 
      matchPhoneNumbers(apt.clientPhone, inputPhone)
    );

    const appointment = candidates.find((apt: any) => {
      const aptCode = (apt.bookingCode || apt.id || '').toUpperCase();
      return aptCode === cleanCode;
    });

    // Validar também o vínculo exato do token com o agendamento
    if (appointment && !isAdmin && req.cookies?.guest_token) {
      if (req.user?.guestAppointmentId && req.user.guestAppointmentId !== appointment.id) {
        return res.status(403).json({ error: 'Acesso negado: Sessão não autorizada para este agendamento.' });
      }
    }

    if (!appointment) {
      return res.status(404).json({ error: 'Reserva não encontrada. Verifique os dados.' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ error: 'Este agendamento já foi cancelado.' });
    }

    if (typeof db.transaction === 'function') {
      await db.transaction(async (tx: any) => {
        await tx.update(schema.appointments)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(schema.appointments.id, appointment.id));
        await tx.update(schema.waitingQueue)
          .set({ status: 'abandoned', updatedAt: new Date() })
          .where(eq(schema.waitingQueue.appointmentId, appointment.id));
      });
    } else {
      await db.update(schema.appointments)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(schema.appointments.id, appointment.id));
      await db.update(schema.waitingQueue)
        .set({ status: 'abandoned', updatedAt: new Date() })
        .where(eq(schema.waitingQueue.appointmentId, appointment.id));
    }

    const msg = `❌ *NAVO BARBER & CLUB*\n\n` +
      `Olá, *${appointment.clientName}*!\n\n` +
      `Seu agendamento para *${appointment.date}* às *${appointment.timeSlot}* foi *CANCELADO*.\n\n` +
      `Ficamos à disposição para remarcar quando desejar! 💈`;
    
    sendWhatsAppMessage(appointment.clientPhone || inputPhone, msg).catch(() => {});
    notifyClientByEmail(appointment.clientId, appointment, 'cancel');
    notifyShopByEmail(appointment, 'cancel');
    sendAdminPush({
      title: 'Agendamento cancelado',
      body: `${appointment.clientName || 'Cliente'} · ${appointment.date} às ${appointment.timeSlot} · O agendamento foi cancelado.`,
      tag: `appointment:${appointment.id}:cancelled`,
      url: '/admin',
    }).catch((error) => console.warn('[Admin Push] Falha ao notificar cancelamento:', error));

    return res.json({ 
      success: true, 
      message: 'Agendamento cancelado com sucesso.' 
    });

  } catch (e: any) {
    console.error('[API] Erro em lookup/cancel:', e);
    return res.status(500).json({ error: 'Erro ao cancelar. Tente novamente.' });
  }
});

// =====================================
// Appointments API
// =====================================
appointmentsRouter.get("/", optionalAuth, async (req: any, res) => {
  try {
    const userRole = req.user?.role || 'guest';
    const userId = req.user?.id || '';
    const isAdmin = userRole === 'admin';
    const isGuest = userRole === 'guest' || !userId || userId === 'usr_guest' || userId.startsWith('guest_');

    const searchPhone = (req.query.phone || req.query.clientPhone || '').toString().trim();

    const dbApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);

    // Se a requisição passou telefone para busca (ex: consulta do cliente por telefone)
    if (searchPhone) {
      let isAuthorized = false;
      if (isAdmin) {
        isAuthorized = true;
      } else if (req.user?.phone && matchPhoneNumbers(req.user.phone, searchPhone)) {
        isAuthorized = true;
      } else if (req.cookies?.guest_token) {
        try {
          const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
          if (guestDecoded.phone && matchPhoneNumbers(guestDecoded.phone, searchPhone)) {
            isAuthorized = true;
            // Restrict search to only the appointment authorized by this guest token
            req.user = { ...req.user, guestAppointmentId: guestDecoded.appointmentId };
          }
        } catch (e) {
          // Token inválido ou expirado
        }
      }

      if (!isAuthorized) {
        return res.status(401).json({ error: 'Sessão expirada ou não autorizada. Valide o código novamente.' });
      }

      let filtered = dbApts.filter(a => matchPhoneNumbers(a.clientPhone, searchPhone));
      if (!isAdmin && !(req.user?.phone && matchPhoneNumbers(req.user.phone, searchPhone)) && req.user?.guestAppointmentId) {
        filtered = filtered.filter(a => a.id === req.user.guestAppointmentId);
      }
      return res.json(filtered);
    }

    // Se for administrador sem telefone de busca, retorna todos
    if (isAdmin) {
      return res.json(dbApts);
    }

    // Usuários autenticados só podem consultar registros vinculados ao próprio clientId.
    // O telefone não é um identificador de posse: pode ser compartilhado entre contas,
    // reciclado ou informado por outra pessoa.
    if (!isGuest && userId) {
      const filtered = dbApts.filter(a => a.clientId === userId);
      return res.json(filtered);
    }

    // Se for visitante sem parâmetro de telefone
    return res.json([]);
  } catch (e: any) {
    console.error('[API] GET /api/appointments Error:', e);
    return handleError(res, e, req.path);
  }
});

appointmentsRouter.post("/", optionalAuth, async (req: any, res) => {
  try {
    const data = req.body;
    
    // LGPD & Validation
    try {
      bookingSchema.parse(data);
    } catch (validationError) {
      return res.status(400).json({ error: 'Dados inválidos', details: validationError });
    }

    const professionalId = data.professionalId || data.professional_id;
    const date = data.date;
    const timeSlot = data.timeSlot || data.time_slot;

    if (!professionalId || !date || !timeSlot) {
      return res.status(400).json({ error: 'Profissional, data e horário são obrigatórios' });
    }

    const todayBRT = getTodayStringBRT();
    const currTimeBRT = getCurrentTimeBRT();
    const reqStart = timeToMinutes(timeSlot);
    const isAdmin = req.user && req.user.role === 'admin';
    const isAdminManual = isAdmin && data.adminManual === true;

    if (!isAdminManual && (date < todayBRT || (date === todayBRT && reqStart <= currTimeBRT.totalMinutes))) {
      return res.status(400).json({ error: 'Não é possível agendar para uma data ou horário que já passou.' });
    }

    // Calculate total price and total duration from services on the server side.
    let calculatedTotal = 0;
    let calculatedDuration = 0;

    let allServices = await db.query.services.findMany();

    const requestedServiceIds: string[] = Array.isArray(data.services)
      ? data.services.map((reqSvc: any) => (typeof reqSvc === 'string' ? reqSvc : reqSvc?.id)).filter(Boolean)
      : [];

    if (requestedServiceIds.length > 0) {
      const unmatchedIds: string[] = [];
      for (const srvId of requestedServiceIds) {
        const srv = allServices.find((s: any) => s.id === srvId);
        if (srv) {
          calculatedTotal += Number(srv.price || 0);
          calculatedDuration += Number(srv.durationMinutes || srv.duration_minutes || 0);
        } else {
          unmatchedIds.push(srvId);
        }
      }
      if (unmatchedIds.length > 0) {
        return res.status(400).json({ error: 'Um ou mais serviços selecionados são inválidos.', invalidServiceIds: unmatchedIds });
      }
    } else if (isAdmin && data.originalAmount) {
      calculatedTotal = Number(data.originalAmount ?? data.original_amount ?? 0);
      if (!Number.isFinite(calculatedTotal) || calculatedTotal < 0) calculatedTotal = 0;
      calculatedDuration = Number(data.totalDurationMinutes ?? data.total_duration_minutes ?? 30);
    } else {
      return res.status(400).json({ error: 'Selecione ao menos um serviço válido.' });
    }

    if (calculatedDuration <= 0) {
      calculatedDuration = 30;
    }

    const checkRes = await checkSlotAvailability({
      dateStr: date,
      startMins: reqStart,
      reqDuration: calculatedDuration,
      profId: professionalId,
      todayBRT,
      currTimeBRT,
      allowPast: isAdminManual,
    });

    if (!checkRes.available) {
      return res.status(409).json({ error: checkRes.reason || 'Este horário conflita com outro agendamento ou bloqueio de agenda.' });
    }

    let resolvedProfessionalId = professionalId;
    let resolvedProfessionalName = data.professionalName || data.professional_name || 'Profissional';

    if (resolvedProfessionalId === 'prof_any') {
      if (checkRes.chosenProf) {
        resolvedProfessionalId = checkRes.chosenProf.id;
        resolvedProfessionalName = checkRes.chosenProf.name;
      }
    } else {
      const allProfs = await db.query.professionals.findMany();
      const profObj = allProfs.find((p: any) => p.id === resolvedProfessionalId);
      if (profObj) {
        resolvedProfessionalName = profObj.name;
      }
    }

    const originalAmount = calculatedTotal;

    // Discount amount comes from the client, so it must be validated server-side.
    // Non-admins cannot apply an arbitrary discount; only admins (e.g. manual adjustments
    // via the admin panel) may set a discount value directly. For everyone else, the
    // discount is clamped to the calculated total to prevent a negative or forged final price.
    let rawDiscount = Number(data.discountAmount ?? data.discount_amount ?? 0);
    if (!Number.isFinite(rawDiscount) || rawDiscount < 0) rawDiscount = 0;
    const discountAmount = isAdmin
      ? Math.min(rawDiscount, originalAmount)
      : 0;
    const finalAmount = Math.max(0, originalAmount - discountAmount);

    let clientId = data.clientId || data.client_id || (req.user?.id || 'guest');

    // Ensure regular users cannot spoof booking for other users
    if (!isAdmin && req.user && req.user.id && req.user.role !== 'guest' && req.user.id !== 'usr_guest' && !req.user.id.startsWith('guest_')) {
      clientId = req.user.id;
    }

    // Guests (unauthenticated) must not be able to attach the booking to an existing
    // registered profile just by guessing/knowing that profile's id.
    if (!isAdmin && (!req.user || !req.user.id || req.user.role === 'guest' || req.user.id === 'usr_guest' || req.user.id.startsWith('guest_'))) {
      const requestedClientId = data.clientId || data.client_id;
      if (requestedClientId) {
        const existingProfile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, requestedClientId) });
        if (existingProfile) {
          // Requested id belongs to a real, existing account — a guest cannot claim it.
          // Fall back to a freshly generated guest id instead.
          clientId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }
      }
    }

    let clientName = data.clientName || data.client_name || 'Cliente';
    let clientPhone = sanitizePhone(data.clientPhone || data.client_phone || '');
    const rawClientEmail = data.clientEmail ?? data.client_email ?? '';
    const clientEmail = typeof rawClientEmail === 'string' ? rawClientEmail.trim().toLowerCase() : '';

    // Ensure client profile exists
    if (isDbConnected && db) {
      try {
        const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, clientId) });
        if (!profile) {
          const cleanId = clientId.replace(/[^a-zA-Z0-9_-]/g, '');
          const safeEmail = `${cleanId}_${Date.now()}@guest.barberx.app`;
          await db.insert(schema.profiles).values({
            id: clientId,
            name: clientName,
            email: safeEmail,
            phone: clientPhone || null,
            role: 'client',
            loyaltyPoints: 0,
            loyaltyTier: 'Bronze'
          }).onConflictDoNothing();
        } else {
          if (!isAdmin && req.user && req.user.id && req.user.role !== 'guest' && req.user.id !== 'usr_guest' && !req.user.id.startsWith('guest_')) {
            if (profile.name) clientName = profile.name;
            if (!clientPhone && profile.phone) clientPhone = profile.phone;
          }
        }
      } catch (e) {
        console.warn('[API] Could not check/create guest profile:', e);
      }
    }

    const isPendingApproval = checkRes.requiresApproval || data.status === 'pending_approval';

    const newApt = {
      id: `apt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
      clientId,
      clientName,
      clientPhone,
      clientEmail: clientEmail || null,
      professionalId: resolvedProfessionalId,
      professionalName: resolvedProfessionalName,
      date,
      timeSlot,
      status: isPendingApproval ? 'pending_approval' : (isAdmin && data.status ? data.status : 'confirmed'),
      totalDurationMinutes: calculatedDuration > 0 ? calculatedDuration : Number(data.totalDurationMinutes || data.total_duration_minutes || 30),
      originalAmount: originalAmount.toString(),
      discountAmount: discountAmount.toString(),
      finalAmount: finalAmount.toString(),
      paymentMethod: data.paymentMethod || data.payment_method || 'PIX',
      bookingCode: generateBookingCode(),
      services: data.services || [],
      createdAt: new Date().toISOString()
    };

    // 2. Atomic Save (Transaction)
    if (isDbConnected && db && typeof db.transaction === 'function') {
      try {
        await db.transaction(async (tx: any) => {
          const lockKey = `${resolvedProfessionalId}:${date}`;
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
          const lockedCheck = await checkSlotAvailability({
            dateStr: date,
            startMins: reqStart,
            reqDuration: calculatedDuration,
            profId: resolvedProfessionalId,
            todayBRT,
            currTimeBRT,
            allowPast: isAdminManual,
          });
          if (!lockedCheck.available) throw new Error('BOOKING_CONFLICT');

          // A. Ensure professional exists in DB before referencing in appointments
          if (resolvedProfessionalId && resolvedProfessionalId !== 'prof_any') {
            const profCheck = await tx.query.professionals.findFirst({
              where: eq(schema.professionals.id, resolvedProfessionalId)
            });
            if (!profCheck || !profCheck.isActive) {
              throw new Error('PROFESSIONAL_NOT_FOUND');
            }
          }

          // B. Ensure profile exists in DB before referencing in appointments
          if (clientId) {
            const profileCheck = await tx.query.profiles.findFirst({
              where: eq(schema.profiles.id, clientId)
            });
            if (!profileCheck) {
              const cleanId = clientId.replace(/[^a-zA-Z0-9_-]/g, '');
              const safeEmail = `${cleanId}_${Date.now()}@guest.barberx.app`;
              await tx.insert(schema.profiles).values({
                id: clientId,
                name: clientName || 'Cliente',
                email: safeEmail,
                phone: clientPhone || null,
                role: 'client',
                loyaltyPoints: 0,
                loyaltyTier: 'Bronze'
              }).onConflictDoNothing();
            }
          }

          const dbApt = {
            ...newApt,
            createdAt: newApt.createdAt ? new Date(newApt.createdAt) : new Date()
          };
          await tx.insert(schema.appointments).values(dbApt);

          // Auto-feed waiting queue if appointment is for today
          // (usa getTodayStringBRT — não new Date().toISOString(), que retorna a data em UTC
          // e diverge do dia real em BRT entre 21h e 23h59, horário de Brasília)
          const todayStr = getTodayStringBRT();
          if (newApt.date === todayStr && newApt.status !== 'cancelled') {
            const serviceTitle = Array.isArray(newApt.services) && newApt.services.length > 0
              ? (typeof newApt.services[0] === 'string' ? newApt.services[0] : (newApt.services[0].title || 'Atendimento BarberX'))
              : 'Atendimento BarberX';

            const queueItem = {
              id: `q_${newApt.id}`,
              appointmentId: newApt.id,
              clientId: newApt.clientId,
              clientName: newApt.clientName,
              clientPhone: newApt.clientPhone,
              professionalId: newApt.professionalId,
              professionalName: newApt.professionalName,
              serviceTitle,
              servicePrice: newApt.finalAmount,
              scheduledTime: newApt.timeSlot,
              arrivedAt: null,
              notes: null,
              status: newApt.status === 'in_service' ? 'in_chair' : 'waiting',
              joinedAt: new Date(),
              estimatedWaitMinutes: 15,
              updatedAt: new Date()
            };
            await tx.insert(schema.waitingQueue).values(queueItem).onConflictDoNothing();
          }
        });
      } catch (err: any) {
        const errMsg = err?.message || '';
        const causeMsg = err?.cause?.message || err?.cause?.constraint_name || '';
        const pgCode = err?.code || err?.cause?.code || '';
        const pgConstraint = err?.constraint || err?.cause?.constraint || '';
        const fullErr = `${errMsg} ${causeMsg} ${pgCode} ${pgConstraint}`;

        if (fullErr.includes('BOOKING_CONFLICT') || fullErr.includes('booking_conflict_idx') || fullErr.includes('23505') || pgCode === '23505') {
          return res.status(409).json({ error: 'Este horário ou código já está reservado. Por favor, tente novamente.' });
        } else {
          console.error('[API] Atomic transaction failed:', err);

          if (fullErr.includes('PROFESSIONAL_NOT_FOUND') || fullErr.includes('appointments_professional_id_fkey')) {
            return res.status(400).json({ error: 'Profissional não encontrado ou inativo.' });
          }
          if (fullErr.includes('appointments_client_id_fkey')) {
            return res.status(400).json({ error: 'Erro no perfil do cliente. Atualize a página e tente novamente.' });
          }

          return res.status(400).json({ error: 'Falha ao salvar agendamento no banco de dados. Por favor, tente novamente.' });
        }
      }
    } else {
      return res.status(503).json({ error: 'O banco não oferece transação para concluir o agendamento com segurança.' });
    }


    // Disparo de mensagem WhatsApp (Confirmação ou Cancelamento)
    let phone = newApt.clientPhone || '5511999999999';
    if (!newApt.clientPhone && newApt.clientId) {
      const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, newApt.clientId) });
      if (profile && profile.phone) phone = sanitizePhone(profile.phone);
    }

    // Garantir que o número tem o tamanho certo para o WhatsApp (mínimo 12 dígitos com o 55)
    if (!phone || phone.length < 12) {
      console.warn(`[WhatsApp] Número inválido para envio: ${phone}. Usando fallback.`);
      phone = '5511999999999'; 
    }
    if (newApt.status === 'cancelled') {
      const msg = `❌ *NAVO BARBER & CLUB*\n\nOlá, *${newApt.clientName || 'Cliente'}*!\nSeu agendamento para *${newApt.date}* às *${newApt.timeSlot}* foi *CANCELADO* com sucesso.\n\nFicamos à disposição para remarcar quando desejar! 💈`;
      sendWhatsAppMessage(phone, msg).catch(() => {});
      notifyClientByEmail(newApt.clientId, newApt, 'cancel');
      notifyShopByEmail(newApt, 'cancel');
    } else {
      const msg = `💈 *NAVO BARBER & CLUB*\n\nOlá, *${newApt.clientName || 'Cliente'}*!\n\nSeu agendamento foi *confirmado* com sucesso:\n\n🔑 *Código:* ${newApt.bookingCode || newApt.id}\n📅 *Data:* ${newApt.date}\n⏰ *Horário:* ${newApt.timeSlot}\n✂️ *Barbeiro:* ${newApt.professionalName || 'Profissional Navo'}\n\n📍 *Local:* Navo Barber & Club - Rua Fortaleza, 1420 - Expectativa, Sobral - CE\n\nTe esperamos com o café pronto! ☕`;
      sendWhatsAppMessage(phone, msg).catch(() => {});
      notifyClientByEmail(newApt.clientId, newApt, 'booking');
      notifyShopByEmail(newApt, 'booking');
    }

    invalidateAvailabilityCache();
    const appointmentPush = newApt.status === 'cancelled'
      ? {
          title: 'Agendamento cancelado',
          body: `${newApt.clientName || 'Cliente'} · ${newApt.date} às ${newApt.timeSlot} · o compromisso foi cancelado.`,
          tag: `appointment:${newApt.id}:cancelled`,
        }
      : {
          title: 'Novo agendamento',
          body: `${newApt.clientName || 'Cliente'} · ${newApt.date} às ${newApt.timeSlot} · ${newApt.professionalName || 'Profissional a definir'}.`,
          tag: `appointment:${newApt.id}:new`,
        };
    sendAdminPush({ ...appointmentPush, url: '/admin' }).catch(() => {});
    res.json(newApt);
  } catch (e: any) {
    console.error('Error in POST /api/appointments:', e);
    return handleError(res, e, req.path);
  }
});


appointmentsRouter.post("/:id/review", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Avaliação inválida.' });
    }

    const dbApt = await db.query.appointments.findFirst({ where: eq(schema.appointments.id, id) });
    if (!dbApt) return res.status(404).json({ error: 'Agendamento não encontrado' });
    if (dbApt.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (dbApt.status !== 'completed') {
      return res.status(400).json({ error: 'Apenas agendamentos concluídos podem ser avaliados.' });
    }
    if (dbApt.isReviewed) {
      return res.status(400).json({ error: 'Este agendamento já foi avaliado.' });
    }

    const reviewId = 'rev_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    if (typeof db.transaction !== 'function') {
      return res.status(503).json({ error: 'O banco não oferece transação para registrar a avaliação.' });
    }
    await db.transaction(async (tx: any) => {
      await tx.insert(schema.reviews).values({
        id: reviewId,
        appointmentId: id,
        clientId: req.user.id,
        professionalId: dbApt.professionalId,
        rating,
        comment: comment || null,
        createdAt: new Date(),
      });
      await tx.update(schema.appointments).set({
        isReviewed: true,
        updatedAt: new Date()
      }).where(eq(schema.appointments.id, id));
    });

    // Optional: update professional rating logic can go here
    // for now we just return success

    res.json({ success: true });
  } catch (e: any) {
    console.error('Error in POST /api/appointments/:id/review:', e);
    return handleError(res, e, req.path);
  }
});

appointmentsRouter.patch("/:id/cancel", sensitiveOpsLimiter, optionalAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    let updatedApt: any = null;
    const isAdmin = req.user?.role === 'admin';

    const dbApt = await db.query.appointments.findFirst({ where: eq(schema.appointments.id, id) });
    if (!dbApt) return res.status(404).json({ error: 'Agendamento não encontrado' });

    if (!isAdmin) {
      let userPhone = req.user?.phone;
      if (!userPhone && req.user?.id && req.user.id !== 'usr_guest') {
        const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
        if (dbUser) userPhone = dbUser.phone;
      }

      const isOwner = req.user?.id && req.user.id !== 'usr_guest' && dbApt.clientId === req.user.id;
      const isPhoneMatch = userPhone && dbApt.clientPhone && matchPhoneNumbers(userPhone, dbApt.clientPhone);
      
      const reqPhone = req.body.clientPhone || req.body.client_phone;
      const reqCode = req.body.bookingCode || req.body.booking_code;
      const isLookupMatch = reqPhone && dbApt.clientPhone && matchPhoneNumbers(reqPhone, dbApt.clientPhone) &&
                            reqCode && dbApt.bookingCode && reqCode.toUpperCase().trim() === dbApt.bookingCode.toUpperCase().trim();

      // Check for guest_token cookie validation
      let isGuestTokenMatch = false;
      if (req.cookies?.guest_token) {
        try {
          const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
          if (guestDecoded.phone && dbApt.clientPhone && matchPhoneNumbers(guestDecoded.phone, dbApt.clientPhone)) {
            if (guestDecoded.appointmentId === dbApt.id) {
              isGuestTokenMatch = true;
            }
          }
        } catch (e) {}
      }

      if (!isOwner && !isPhoneMatch && !isLookupMatch && !isGuestTokenMatch) {
        return res.status(403).json({ error: 'Acesso negado: Você não tem autorização para cancelar este agendamento' });
      }
    }

    if (typeof db.transaction === 'function') {
      await db.transaction(async (tx: any) => {
        await tx.update(schema.appointments).set({
          status: 'cancelled',
          cancellationReason: reason || 'Cancelado pelo cliente',
          updatedAt: new Date()
        }).where(eq(schema.appointments.id, id));
        await tx.update(schema.waitingQueue).set({
          status: 'cancelled',
          updatedAt: new Date()
        }).where(eq(schema.waitingQueue.appointmentId, id));
      });
    } else {
      await db.update(schema.appointments).set({
        status: 'cancelled',
        cancellationReason: reason || 'Cancelado pelo cliente',
        updatedAt: new Date()
      }).where(eq(schema.appointments.id, id));
      await db.update(schema.waitingQueue).set({
        status: 'cancelled',
        updatedAt: new Date()
      }).where(eq(schema.waitingQueue.appointmentId, id));
    }
    
    updatedApt = { ...dbApt, status: 'cancelled', cancellationReason: reason };

    if (updatedApt) {
      let phone = updatedApt.clientPhone || '5511999999999';
      if (!updatedApt.clientPhone && updatedApt.clientId) {
        const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, updatedApt.clientId) });
        if (profile && profile.phone) phone = profile.phone;
      }
      const msg = `❌ *NAVO BARBER & CLUB*\n\nOlá, *${updatedApt.clientName || 'Cliente'}*!\nSeu agendamento para *${updatedApt.date}* às *${updatedApt.timeSlot}* foi *CANCELADO* com sucesso.\n\nFicamos à disposição para remarcar quando desejar! 💈`;

      sendWhatsAppMessage(phone, msg).catch(() => {});
      notifyClientByEmail(updatedApt.clientId, updatedApt, 'cancel');
      notifyShopByEmail(updatedApt, 'cancel');
      const serviceTitle = Array.isArray(updatedApt.services) ? updatedApt.services[0]?.title || 'Serviço agendado' : 'Serviço agendado';
      sendAdminPush({
        title: 'Agendamento cancelado',
        body: `${updatedApt.clientName || 'Cliente'} · ${serviceTitle} · ${updatedApt.date} às ${updatedApt.timeSlot} · O agendamento foi cancelado.`,
        tag: `appointment:${updatedApt.id}:cancelled`,
        url: '/admin',
      }).catch((error) => console.warn('[Admin Push] Falha ao notificar cancelamento:', error));
    }

    res.json({ success: true, updated: updatedApt });
  } catch (e: any) {
    console.error('[API] Error canceling appointment:', e);
    return handleError(res, e, req.path);
  }
});

appointmentsRouter.put("/:id", sensitiveOpsLimiter, optionalAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const isAdmin = req.user?.role === 'admin';

    const dbApt = await db.query.appointments.findFirst({ where: eq(schema.appointments.id, id) });
    if (!dbApt) return res.status(404).json({ error: 'Agendamento não encontrado' });
    if (!isAdmin && ['completed', 'cancelled'].includes(dbApt.status)) {
      return res.status(400).json({ error: 'Agendamentos concluídos ou cancelados não podem ser editados.' });
    }
    if (!isAdmin && data.status !== undefined) {
      return res.status(403).json({ error: 'Somente a equipe autorizada pode alterar o status do agendamento.' });
    }

    if (!isAdmin) {
      let userPhone = req.user?.phone;
      if (!userPhone && req.user?.id && req.user.id !== 'usr_guest') {
        const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
        if (dbUser) userPhone = dbUser.phone;
      }

      const isOwner = req.user?.id && req.user.id !== 'usr_guest' && dbApt.clientId === req.user.id;
      const isPhoneMatch = userPhone && dbApt.clientPhone && matchPhoneNumbers(userPhone, dbApt.clientPhone);
      
      const reqPhone = req.body.clientPhone || req.body.client_phone;
      const reqCode = req.body.bookingCode || req.body.booking_code;
      const isLookupMatch = reqPhone && dbApt.clientPhone && matchPhoneNumbers(reqPhone, dbApt.clientPhone) &&
                            reqCode && dbApt.bookingCode && reqCode.toUpperCase().trim() === dbApt.bookingCode.toUpperCase().trim();

      // Check for guest_token cookie validation
      let isGuestTokenMatch = false;
      if (req.cookies?.guest_token) {
        try {
          const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
          if (guestDecoded.phone && dbApt.clientPhone && matchPhoneNumbers(guestDecoded.phone, dbApt.clientPhone)) {
            if (guestDecoded.appointmentId === dbApt.id) {
              isGuestTokenMatch = true;
            }
          }
        } catch (e) {}
      }

      if (!isOwner && !isPhoneMatch && !isLookupMatch && !isGuestTokenMatch) {
        return res.status(403).json({ error: 'Acesso negado: Você não tem autorização para editar este agendamento' });
      }
    }

    const newDate = data.date || dbApt.date;
    const newTimeSlot = data.timeSlot || data.time_slot || dbApt.timeSlot;
    let newProfessionalId = data.professionalId || data.professional_id || dbApt.professionalId;
    let resolvedProfessionalName = dbApt.professionalName;
    let durationMins = Number(data.totalDurationMinutes || data.total_duration_minutes || dbApt.totalDurationMinutes || 30);
    if (!dateSchema.safeParse(newDate).success || !timeSchema.safeParse(newTimeSlot).success) {
      return res.status(400).json({ error: 'Data ou horário inválidos.' });
    }
    if (!Number.isInteger(durationMins) || durationMins < 5 || durationMins > 480) {
      return res.status(400).json({ error: 'Duração inválida.' });
    }

    if (newDate !== dbApt.date || newTimeSlot !== dbApt.timeSlot || newProfessionalId !== dbApt.professionalId || data.services !== undefined) {
      const todayBRT = getTodayStringBRT();
      const currTimeBRT = getCurrentTimeBRT();
      const reqStart = timeToMinutes(newTimeSlot);
      const reqEnd = reqStart + durationMins;

      const checkRes = await checkSlotAvailability({
        dateStr: newDate,
        startMins: reqStart,
        reqDuration: durationMins,
        profId: newProfessionalId,
        excludeAptId: id,
        todayBRT,
        currTimeBRT,
      });

      if (!checkRes.available) {
        return res.status(409).json({ error: checkRes.reason || 'Este horário conflita com outro agendamento ou bloqueio de agenda.' });
      }

      if (newProfessionalId === 'prof_any') {
        if (!checkRes.chosenProf) {
          return res.status(409).json({ error: 'Nenhum profissional disponível para este horário.' });
        }
        newProfessionalId = checkRes.chosenProf.id;
      }
      const selectedProfessional = checkRes.chosenProf || await db.query.professionals.findFirst({ where: eq(schema.professionals.id, newProfessionalId) });
      if (!selectedProfessional || !selectedProfessional.isActive) {
        return res.status(400).json({ error: 'Profissional não encontrado ou inativo.' });
      }
      resolvedProfessionalName = selectedProfessional.name;
    }

    if (isDbConnected && db) {
      try {
        const updateData: any = { updatedAt: new Date() };
        
        if (data.status !== undefined) updateData.status = data.status;
        if (data.date !== undefined) updateData.date = data.date;
        if (data.timeSlot !== undefined) updateData.timeSlot = data.timeSlot;
        if (data.time_slot !== undefined) updateData.timeSlot = data.time_slot;
        
        if (data.clientPhone !== undefined) updateData.clientPhone = sanitizePhone(data.clientPhone);
        if (data.client_phone !== undefined) updateData.clientPhone = sanitizePhone(data.client_phone);
        if (data.clientEmail !== undefined || data.client_email !== undefined) {
          const rawEmail = data.clientEmail ?? data.client_email ?? '';
          if (rawEmail && (typeof rawEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail.trim()))) {
            return res.status(400).json({ error: 'Informe um e-mail válido ou deixe o campo em branco.' });
          }
          updateData.clientEmail = typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim().toLowerCase() : null;
        }
        if (data.clientName !== undefined) updateData.clientName = data.clientName;
        if (data.client_name !== undefined) updateData.clientName = data.client_name;
        if (data.professionalId !== undefined || data.professional_id !== undefined) {
          updateData.professionalId = newProfessionalId;
          updateData.professionalName = data.professionalName || data.professional_name || resolvedProfessionalName;
        }
        // Price fields (originalAmount/discountAmount/finalAmount) are NEVER taken verbatim
        // from the request body. They are recalculated server-side below, the same way
        // POST /api/appointments does it, so a caller cannot forge or zero out the price
        // by editing an existing appointment.
        const newServices = data.services !== undefined ? data.services : dbApt.services;
        if (data.services !== undefined) updateData.services = newServices;
        if (data.totalDurationMinutes !== undefined) updateData.totalDurationMinutes = data.totalDurationMinutes;
        if (data.total_duration_minutes !== undefined) updateData.totalDurationMinutes = data.total_duration_minutes;

        if (data.services !== undefined) {
          // Services changed (or were re-sent): recompute price/duration from the DB, never from the client.
          // Every id must resolve to a real service — an unmatched id is a validation
          // error, not a silent 0 (which would let a non-admin zero out the price by
          // sending an empty/invalid services array on an edit).
          const allServices = await db.query.services.findMany();
          let recalcTotal = 0;
          let recalcDuration = 0;
          const editRequestedIds: string[] = Array.isArray(newServices)
            ? newServices.map((reqSvc: any) => (typeof reqSvc === 'string' ? reqSvc : reqSvc?.id)).filter(Boolean)
            : [];

          if (editRequestedIds.length === 0 && !isAdmin) {
            return res.status(400).json({ error: 'Selecione ao menos um serviço válido.' });
          }

          const editUnmatchedIds: string[] = [];
          for (const srvId of editRequestedIds) {
            const srv = allServices.find((s: any) => s.id === srvId);
            if (srv) {
              recalcTotal += Number(srv.price || 0);
              recalcDuration += Number(srv.durationMinutes || srv.duration_minutes || 0);
            } else {
              editUnmatchedIds.push(srvId);
            }
          }
          if (editUnmatchedIds.length > 0 && !isAdmin) {
            return res.status(400).json({ error: 'Um ou mais serviços selecionados são inválidos.', invalidServiceIds: editUnmatchedIds });
          }
          updateData.originalAmount = recalcTotal.toString();
          if (recalcDuration > 0) {
            updateData.totalDurationMinutes = recalcDuration;
            durationMins = recalcDuration;
          }

          let rawDiscount = Number(data.discountAmount ?? data.discount_amount ?? 0);
          if (!Number.isFinite(rawDiscount) || rawDiscount < 0) rawDiscount = 0;
          const cappedDiscount = isAdmin ? Math.min(rawDiscount, recalcTotal) : 0;
          updateData.discountAmount = cappedDiscount.toString();
          updateData.finalAmount = Math.max(0, recalcTotal - cappedDiscount).toString();
        } else if (isAdmin && (data.discountAmount !== undefined || data.discount_amount !== undefined)) {
          // Admin manually adjusting the discount on an unchanged set of services.
          const baseAmount = Number(dbApt.originalAmount || 0);
          let rawDiscount = Number(data.discountAmount ?? data.discount_amount ?? 0);
          if (!Number.isFinite(rawDiscount) || rawDiscount < 0) rawDiscount = 0;
          const cappedDiscount = Math.min(rawDiscount, baseAmount);
          updateData.discountAmount = cappedDiscount.toString();
          updateData.finalAmount = Math.max(0, baseAmount - cappedDiscount).toString();
        }

        if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
        if (data.payment_method !== undefined) updateData.paymentMethod = data.payment_method;

        if (typeof db.transaction !== 'function') {
          return res.status(503).json({ error: 'O banco não oferece transação para atualizar o agendamento com segurança.' });
        }

        let updatedApt: any;
        await db.transaction(async (tx: any) => {
          const scheduleChanged = newDate !== dbApt.date || newTimeSlot !== dbApt.timeSlot || newProfessionalId !== dbApt.professionalId || data.services !== undefined;
          if (scheduleChanged) {
            const lockKey = `${newProfessionalId}:${newDate}`;
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
            const lockedCheck = await checkSlotAvailability({
              dateStr: newDate,
              startMins: timeToMinutes(newTimeSlot),
              reqDuration: durationMins,
              profId: newProfessionalId,
              excludeAptId: id,
              todayBRT: getTodayStringBRT(),
              currTimeBRT: getCurrentTimeBRT(),
            });
            if (!lockedCheck.available) throw new Error('BOOKING_CONFLICT');
            const prof = await tx.query.professionals.findFirst({ where: eq(schema.professionals.id, newProfessionalId) });
            if (!prof || !prof.isActive) throw new Error('PROFESSIONAL_NOT_FOUND');
          }

          const [saved] = await tx.update(schema.appointments)
            .set(updateData)
            .where(eq(schema.appointments.id, id))
            .returning();
          if (!saved) throw new Error('APPOINTMENT_NOT_FOUND');
          updatedApt = saved;

          const queueUpdate: any = {
            scheduledTime: saved.timeSlot,
            professionalId: saved.professionalId,
            professionalName: saved.professionalName,
            servicePrice: saved.finalAmount,
            updatedAt: new Date(),
          };
          if (saved.status === 'cancelled') queueUpdate.status = 'abandoned';
          if (saved.status === 'in_service') queueUpdate.status = 'in_chair';
          await tx.update(schema.waitingQueue)
            .set(queueUpdate)
            .where(eq(schema.waitingQueue.appointmentId, id));
        });

        if (data.status === 'completed' && dbApt.status !== 'completed') {
          await processAppointmentCompletion(updatedApt);
        }

        const scheduleChanged = newDate !== dbApt.date || newTimeSlot !== dbApt.timeSlot || newProfessionalId !== dbApt.professionalId || data.services !== undefined;
        if (scheduleChanged) {
          let phone = updatedApt.clientPhone || '5511999999999';
          if (!updatedApt.clientPhone && updatedApt.clientId) {
            const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, updatedApt.clientId) });
            if (profile && profile.phone) phone = profile.phone;
          }
          const msg = `🔄 *NAVO BARBER & CLUB*\n\nOlá, *${updatedApt.clientName || 'Cliente'}*!\n\nSeu agendamento foi *REAGENDADO* com sucesso:\n\n📅 *Nova Data:* ${updatedApt.date}\n⏰ *Novo Horário:* ${updatedApt.timeSlot}\n✂️ *Barbeiro:* ${updatedApt.professionalName || 'Profissional Navo'}\n\n📍 *Local:* Navo Barber & Club - Rua Fortaleza, 1420 - Expectativa, Sobral - CE\n\nTe esperamos com o café pronto! ☕`;

          sendWhatsAppMessage(phone, msg).catch(() => {});
          notifyClientByEmail(updatedApt.clientId, updatedApt, 'reschedule', dbApt);
          notifyShopByEmail(updatedApt, 'reschedule', dbApt);
        }

        invalidateAvailabilityCache();
        if (dbApt.status !== updatedApt.status) {
          const statusPush = updatedApt.status === 'cancelled'
            ? {
                title: 'Agendamento cancelado',
                body: `${updatedApt.clientName || 'Cliente'} · o compromisso foi cancelado na Agenda.`,
                tag: `appointment:${updatedApt.id}:cancelled`,
              }
            : updatedApt.status === 'completed'
              ? {
                  title: 'Atendimento concluído',
                  body: `${updatedApt.clientName || 'Cliente'} · o atendimento foi finalizado.`,
                  tag: `appointment:${updatedApt.id}:completed`,
                }
              : {
                  title: 'Status da Agenda atualizado',
                  body: `${updatedApt.clientName || 'Cliente'} · o agendamento passou para ${updatedApt.status}.`,
                  tag: `appointment:${updatedApt.id}:${updatedApt.status}`,
                };
          sendAdminPush({ ...statusPush, url: '/admin' }).catch(() => {});
        } else if (scheduleChanged) {
          sendAdminPush({
            title: 'Agendamento reagendado',
            body: `${updatedApt.clientName || 'Cliente'} · novo horário ${updatedApt.date} às ${updatedApt.timeSlot}.`,
            tag: `appointment:${updatedApt.id}:rescheduled:${updatedApt.date}:${updatedApt.timeSlot}`,
            url: '/admin',
          }).catch(() => {});
        }
        return res.json(updatedApt);
      } catch (err: any) {
        const fullErr = `${err?.message || ''} ${err?.cause?.message || ''} ${err?.code || ''}`;
        if (fullErr.includes('BOOKING_CONFLICT') || fullErr.includes('23505')) {
          return res.status(409).json({ error: 'Este horário conflita com outro agendamento.' });
        }
        if (fullErr.includes('PROFESSIONAL_NOT_FOUND')) {
          return res.status(400).json({ error: 'Profissional não encontrado ou inativo.' });
        }
        if (fullErr.includes('23514')) {
          return res.status(409).json({
            error: 'O banco rejeitou o status do atendimento. Aplique a migração de integridade mais recente e tente novamente.'
          });
        }
        console.warn('[API] Could not update appointment in Postgres:', err);
        return res.status(500).json({ error: 'Falha ao atualizar agendamento no banco de dados.' });
      }
    }

    res.json({ id, ...dbApt, ...data });
  } catch (e: any) {
    console.error('[API] Error updating appointment:', e);
    return handleError(res, e, req.path);
  }
});

// =====================================
// Products API
// =====================================
