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
import { JWT_SECRET } from '../config/env.js';
import { checkSlotAvailability } from '../services/availability.service.js';



import { processAppointmentCompletion, notifyClientByEmail } from '../index.js';
import { sendWhatsAppMessage } from '../whatsapp.js';

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
      { expiresIn: '1h' }
    );

    res.cookie('guest_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 * 1000 // 1 hour
    });

    return res.json({ success: true, message: 'Validado com sucesso.' });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/appointments/lookup/verify');
  }
});

// POST /api/appointments/lookup/logout — Revoga a sessão de visitante
appointmentsRouter.post("/lookup/logout", (req: any, res) => {
  res.clearCookie('guest_token');
  res.json({ success: true });
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

    await db.update(schema.appointments)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(schema.appointments.id, appointment.id));

    await db.update(schema.waitingQueue)
      .set({ status: 'abandoned', updatedAt: new Date() })
      .where(eq(schema.waitingQueue.appointmentId, appointment.id));

    const msg = `❌ *BARBERX PREMIUM*\n\n` +
      `Olá, *${appointment.clientName}*!\n\n` +
      `Seu agendamento para *${appointment.date}* às *${appointment.timeSlot}* foi *CANCELADO*.\n\n` +
      `Ficamos à disposição para remarcar quando desejar! 💈`;
    
    sendWhatsAppMessage(appointment.clientPhone || inputPhone, msg).catch(() => {});
    notifyClientByEmail(appointment.clientId, appointment, 'cancel');

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

    // Se for usuário autenticado (não convidado)
    if (!isGuest && userId) {
      let userPhone = req.user?.phone || '';
      if (!userPhone) {
        const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId) });
        if (dbUser) userPhone = dbUser.phone || '';
      }
      const filtered = dbApts.filter(a => 
        a.clientId === userId || (userPhone && matchPhoneNumbers(a.clientPhone, userPhone))
      );
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

    if (date < todayBRT || (date === todayBRT && reqStart <= currTimeBRT.totalMinutes)) {
      return res.status(400).json({ error: 'Não é possível agendar para uma data ou horário que já passou.' });
    }

    const isAdmin = req.user && req.user.role === 'admin';

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
      id: data.id || `apt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      clientId,
      clientName,
      clientPhone,
      professionalId: resolvedProfessionalId,
      professionalName: resolvedProfessionalName,
      date,
      timeSlot,
      status: isPendingApproval ? 'pending_approval' : (data.status || 'confirmed'),
      totalDurationMinutes: calculatedDuration > 0 ? calculatedDuration : Number(data.totalDurationMinutes || data.total_duration_minutes || 30),
      originalAmount: originalAmount.toString(),
      discountAmount: discountAmount.toString(),
      finalAmount: finalAmount.toString(),
      paymentMethod: data.paymentMethod || data.payment_method || 'PIX',
      bookingCode: data.bookingCode || generateBookingCode(),
      services: data.services || [],
      createdAt: data.createdAt || new Date().toISOString()
    };

    // 2. Atomic Save (Transaction)
    if (isDbConnected && db && typeof db.transaction === 'function') {
      try {
        await db.transaction(async (tx: any) => {
          // A. Ensure professional exists in DB before referencing in appointments
          if (resolvedProfessionalId && resolvedProfessionalId !== 'prof_any') {
            const profCheck = await tx.query.professionals.findFirst({
              where: eq(schema.professionals.id, resolvedProfessionalId)
            });
            if (!profCheck) {
              await tx.insert(schema.professionals).values({
                id: resolvedProfessionalId,
                name: resolvedProfessionalName || 'Profissional',
                roleTitle: 'Master Barber',
                rating: '5.00',
                reviewsCount: 0,
                commissionRate: '0.40',
                isActive: true,
                workingHours: {}
              }).onConflictDoNothing();
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
          const { createdAt, id: _idKey, ...updateFields } = dbApt;
          await tx.insert(schema.appointments).values(dbApt).onConflictDoUpdate({
            target: schema.appointments.id,
            set: {
              ...updateFields,
              updatedAt: new Date()
            }
          });

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
              professionalId: newApt.professionalId,
              serviceTitle,
              status: newApt.status === 'in_service' ? 'in_chair' : 'waiting',
              joinedAt: new Date(),
              estimatedWaitMinutes: 15
            };
            await tx.insert(schema.waitingQueue).values(queueItem).onConflictDoUpdate({
              target: schema.waitingQueue.id,
              set: queueItem
            });
          }
        });
      } catch (err: any) {
        const errMsg = err?.message || '';
        const causeMsg = err?.cause?.message || err?.cause?.constraint_name || '';
        const pgCode = err?.code || err?.cause?.code || '';
        const pgConstraint = err?.constraint || err?.cause?.constraint || '';
        const fullErr = `${errMsg} ${causeMsg} ${pgCode} ${pgConstraint}`;

        if (fullErr.includes('booking_conflict_idx') || fullErr.includes('23505') || pgCode === '23505') {
          if (fullErr.includes('booking_code')) {
            // Se conflitou no código da reserva, tentar código alternativo
            newApt.bookingCode = generateBookingCode() + 'X';
            const dbApt = { ...newApt, createdAt: new Date() };
            const { createdAt, id: _idKey, ...updateFields } = dbApt;
            await db.insert(schema.appointments).values(dbApt).onConflictDoUpdate({
              target: schema.appointments.id,
              set: { ...updateFields, updatedAt: new Date() }
            });
          } else {
            return res.status(409).json({ error: 'Este horário já está reservado. Por favor, escolha outro.' });
          }
        } else {
          console.error('[API] Atomic transaction failed:', err);

          if (fullErr.includes('appointments_client_id_fkey')) {
            return res.status(400).json({ error: 'Erro no perfil do cliente. Atualize a página e tente novamente.' });
          }
          if (fullErr.includes('appointments_professional_id_fkey')) {
            return res.status(400).json({ error: 'Profissional não encontrado.' });
          }

          return res.status(400).json({ error: 'Falha ao salvar agendamento no banco de dados. Por favor, tente novamente.' });
        }
      }
    } else {
      // Fallback to non-transactional insert
      const dbApt = {
        ...newApt,
        createdAt: newApt.createdAt ? new Date(newApt.createdAt) : new Date()
      };
      const { createdAt, id: _idKey, ...updateFields } = dbApt;
      try {
        await db.insert(schema.appointments).values(dbApt).onConflictDoUpdate({
          target: schema.appointments.id,
          set: {
            ...updateFields,
            updatedAt: new Date()
          }
        });
      } catch (err: any) {
        const errMsg = err?.message || '';
        const causeMsg = err?.cause?.message || err?.cause?.constraint_name || '';
        const pgCode = err?.code || err?.cause?.code || '';
        const pgConstraint = err?.constraint || err?.cause?.constraint || '';
        const fullErr = `${errMsg} ${causeMsg} ${pgCode} ${pgConstraint}`;

        if (fullErr.includes('booking_conflict_idx') || fullErr.includes('23505') || pgCode === '23505') {
          return res.status(409).json({ error: 'Este horário já está reservado. Por favor, escolha outro.' });
        }
        
        console.error("[API] Fallback insert failed:", err);
        return res.status(400).json({ error: "Falha ao salvar agendamento no banco de dados. Por favor, tente novamente." });
      }
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
      const msg = `❌ *BARBERX PREMIUM*\n\nOlá, *${newApt.clientName || 'Cliente'}*!\nSeu agendamento para *${newApt.date}* às *${newApt.timeSlot}* foi *CANCELADO* com sucesso.\n\nFicamos à disposição para remarcar quando desejar! 💈`;
      sendWhatsAppMessage(phone, msg).catch(() => {});
      notifyClientByEmail(newApt.clientId, newApt, 'cancel');
    } else {
      const msg = `💈 *BARBERX PREMIUM*\n\nOlá, *${newApt.clientName || 'Cliente'}*!\n\nSeu agendamento foi *confirmado* com sucesso:\n\n🔑 *Código:* ${newApt.bookingCode || newApt.id}\n📅 *Data:* ${newApt.date}\n⏰ *Horário:* ${newApt.timeSlot}\n✂️ *Barbeiro:* ${newApt.professionalName || 'Profissional BarberX'}\n\n📍 *Local:* BarberX Premium - Rua dos Barões, 1420 - Jardins\n\nTe esperamos com o café pronto! ☕`;
      sendWhatsAppMessage(phone, msg).catch(() => {});
      notifyClientByEmail(newApt.clientId, newApt, 'booking');
    }

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

    await db.insert(schema.reviews).values({
      id: reviewId,
      appointmentId: id,
      professionalId: dbApt.professionalId,
      rating,
      comment
    });

    await db.update(schema.appointments).set({ 
      isReviewed: true,
      updatedAt: new Date() 
    }).where(eq(schema.appointments.id, id));

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

    await db.update(schema.appointments).set({ 
      status: 'cancelled', 
      cancellationReason: reason || 'Cancelado pelo cliente',
      updatedAt: new Date() 
    }).where(eq(schema.appointments.id, id));
    
    await db.update(schema.waitingQueue).set({
      status: 'abandoned',
      updatedAt: new Date()
    }).where(eq(schema.waitingQueue.appointmentId, id));
    
    updatedApt = { ...dbApt, status: 'cancelled', cancellationReason: reason };

    if (updatedApt) {
      let phone = updatedApt.clientPhone || '5511999999999';
      if (!updatedApt.clientPhone && updatedApt.clientId) {
        const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, updatedApt.clientId) });
        if (profile && profile.phone) phone = profile.phone;
      }
      const msg = `❌ *BARBERX PREMIUM*\n\nOlá, *${updatedApt.clientName || 'Cliente'}*!\nSeu agendamento para *${updatedApt.date}* às *${updatedApt.timeSlot}* foi *CANCELADO* com sucesso.\n\nFicamos à disposição para remarcar quando desejar! 💈`;

      sendWhatsAppMessage(phone, msg).catch(() => {});
      notifyClientByEmail(updatedApt.clientId, updatedApt, 'cancel');
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
    const newProfessionalId = data.professionalId || data.professional_id || dbApt.professionalId;
    const durationMins = Number(data.totalDurationMinutes || data.total_duration_minutes || dbApt.totalDurationMinutes || 30);

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
        if (data.clientName !== undefined) updateData.clientName = data.clientName;
        if (data.client_name !== undefined) updateData.clientName = data.client_name;
        if (data.professionalId !== undefined) updateData.professionalId = data.professionalId;
        if (data.professional_id !== undefined) updateData.professionalId = data.professional_id;
        if (data.professionalName !== undefined) updateData.professionalName = data.professionalName;
        if (data.professional_name !== undefined) updateData.professionalName = data.professional_name;
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
          if (recalcDuration > 0) updateData.totalDurationMinutes = recalcDuration;

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

        await db
          .update(schema.appointments)
          .set(updateData)
          .where(eq(schema.appointments.id, id));

        const updatedApt = await db.query.appointments.findFirst({ 
          where: eq(schema.appointments.id, id) 
        });

        if (data.status === 'completed' && dbApt.status !== 'completed') {
          await processAppointmentCompletion(updatedApt);
        }

        if (data.date || data.timeSlot || data.time_slot) {
          let phone = updatedApt.clientPhone || '5511999999999';
          if (!updatedApt.clientPhone && updatedApt.clientId) {
            const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, updatedApt.clientId) });
            if (profile && profile.phone) phone = profile.phone;
          }
          const msg = `🔄 *BARBERX PREMIUM*\n\nOlá, *${updatedApt.clientName || 'Cliente'}*!\n\nSeu agendamento foi *REAGENDADO* com sucesso:\n\n📅 *Nova Data:* ${updatedApt.date}\n⏰ *Novo Horário:* ${updatedApt.timeSlot}\n✂️ *Barbeiro:* ${updatedApt.professionalName || 'Profissional BarberX'}\n\n📍 *Local:* BarberX Premium - Rua dos Barões, 1420 - Jardins\n\nTe esperamos com o café pronto! ☕`;

          sendWhatsAppMessage(phone, msg).catch(() => {});
        }

        return res.json(updatedApt);
      } catch (err: any) {
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
