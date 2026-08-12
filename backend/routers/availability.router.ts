import express from 'express';
import { eq } from 'drizzle-orm';
import { db, isDbConnected } from '../index.js';
import { userErrors } from '../utils/index.js';
import { fetchDaySlotContext, checkSlotAvailability } from '../services/availability.service.js';
import { timeToMinutes, minutesToTime, getDayOfWeekKey, getTodayStringBRT, getCurrentTimeBRT } from '../utils/datetime.js';

export const availabilityRouter = express.Router();

availabilityRouter.get("/", async (req, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: userErrors.dbDisconnected });
    }
    const { professionalId, date, duration, excludeAppointmentId, debug } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Data não informada' });
    }

    const dateStr = String(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Formato de data inválido. Use AAAA-MM-DD.' });
    }
    const profIdStr = professionalId ? String(professionalId) : '';
    if (profIdStr && !/^[a-zA-Z0-9_-]+$/.test(profIdStr)) {
      return res.status(400).json({ error: 'Identificador de profissional inválido.' });
    }

    const excludeAptId = excludeAppointmentId ? String(excludeAppointmentId) : '';
    const reqDuration = Math.max(30, Number(duration || 30));
    const todayBRT = getTodayStringBRT();
    const currTimeBRT = getCurrentTimeBRT();

    // Busca uma única vez (shopSettings, agendamentos, bloqueios e profissionais do dia)
    const daySlotContext = await fetchDaySlotContext(dateStr, excludeAptId);
    const shopProf = daySlotContext.shopProf;
    const dayKey = getDayOfWeekKey(dateStr);
    const daySchedule = shopProf.operatingSchedule?.[dayKey];

    const openStr = daySchedule?.open || shopProf.openTime || '09:00';
    const closeStr = daySchedule?.close || shopProf.closeTime || '21:00';
    const openMins = timeToMinutes(openStr);
    const closeMins = timeToMinutes(closeStr);

    const allowOutsideHours = shopProf.allowOutsideHoursApproval === true;
    const slotsCutoff = allowOutsideHours ? closeMins + 90 : closeMins;
    const daySlots: string[] = [];
    for (let m = openMins; m < slotsCutoff; m += 30) {
      daySlots.push(minutesToTime(m));
    }

    const busySlots: string[] = [];
    const requiresApprovalSlots: string[] = [];
    const availableSlots: string[] = [];
    const detailedSlots: any[] = [];

    for (const slot of daySlots) {
      const startMins = timeToMinutes(slot);
      const checkRes = await checkSlotAvailability({
        dateStr,
        startMins,
        reqDuration,
        profId: profIdStr,
        excludeAptId,
        todayBRT,
        currTimeBRT,
        debug: debug === 'true',
        preloaded: daySlotContext
      });

      if (!checkRes.available) {
        busySlots.push(slot);
      } else if (checkRes.requiresApproval) {
        requiresApprovalSlots.push(slot);
      } else {
        availableSlots.push(slot);
      }

      detailedSlots.push({
        timeSlot: slot,
        statusCode: checkRes.statusCode,
        available: checkRes.available,
        requiresApproval: !!checkRes.requiresApproval,
        isOutsideHours: !!checkRes.isOutsideHours,
        reason: checkRes.reason,
        chosenProf: checkRes.chosenProf ? { id: checkRes.chosenProf.id, name: checkRes.chosenProf.name } : null
      });
    }

    if (req.query.format === 'legacy') {
      return res.json(busySlots.map(ts => ({ timeSlot: ts })));
    }

    return res.json({
      date: dateStr,
      busySlots,
      requiresApprovalSlots,
      availableSlots,
      slots: detailedSlots
    });
  } catch (e: any) {
    console.error('Error in GET /api/availability:', e);
    return res.status(500).json({ error: 'Falha ao processar disponibilidade' });
  }
});
