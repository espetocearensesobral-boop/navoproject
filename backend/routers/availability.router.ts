import express from 'express';
import { eq } from 'drizzle-orm';
import { db, isDbConnected } from '../index.js';
import { userErrors } from '../utils/index.js';
import { fetchDaySlotContext, checkSlotAvailability, invalidateAvailabilityCache as invalidateServiceAvailabilityCache } from '../services/availability.service.js';
import { timeToMinutes, minutesToTime, getDayOfWeekKey, getTodayStringBRT, getCurrentTimeBRT, addDaysBRT } from '../utils/datetime.js';

export const availabilityRouter = express.Router();

// Simple in-memory cache for availability calls
const availabilityCache = new Map<string, { data: any, expiresAt: number }>();

export function invalidateAvailabilityCache() {
  availabilityCache.clear();
  invalidateServiceAvailabilityCache();
}

availabilityRouter.get("/next", async (req, res) => {
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: userErrors.dbDisconnected });
    
    const todayBRT = getTodayStringBRT();
    const currTimeBRT = getCurrentTimeBRT();
    
    // We check up to 3 days to find a slot fast
    for (let i = 0; i < 3; i++) {
      const dateStr = addDaysBRT(todayBRT, i);
      
      const daySlotContext = await fetchDaySlotContext(dateStr, '');
      const shopProf = daySlotContext.shopProf;
      const dayKey = getDayOfWeekKey(dateStr);
      const daySchedule = shopProf.operatingSchedule?.[dayKey];
      const openStr = daySchedule?.open || shopProf.openTime || '09:00';
      const closeStr = daySchedule?.close || shopProf.closeTime || '21:00';
      const openMins = timeToMinutes(openStr);
      const closeMins = timeToMinutes(closeStr);
      
      const slotIntervalMinutes = daySlotContext.operationSettings?.slotIntervalMinutes || 30;
      for (let m = openMins; m < closeMins; m += slotIntervalMinutes) {
        const slot = minutesToTime(m);
        if (dateStr === todayBRT && slot <= currTimeBRT.timeStr) continue;
        
        const checkRes = await checkSlotAvailability({
          dateStr,
          startMins: m,
          reqDuration: 30,
          profId: '',
          excludeAptId: '',
          todayBRT,
          currTimeBRT,
          debug: false,
          preloaded: daySlotContext
        });
        
        if (checkRes.available && !checkRes.requiresApproval) {
          return res.json({ nextAvailableTimeSlot: `${dateStr}T${slot}` });
        }
      }
    }
    
    return res.json({ nextAvailableTimeSlot: null });
  } catch (e: any) {
    console.error('Error in GET /api/availability/next:', e);
    return res.status(500).json({ error: 'Falha ao buscar próximo horário' });
  }
});

availabilityRouter.get("/", async (req, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: userErrors.dbDisconnected });
    }
    const { professionalId, date, duration, excludeAppointmentId, debug } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Data não informada' });
    }
    
    // Check Cache
    const cacheKey = `${date}-${professionalId || ''}-${duration || '30'}-${excludeAppointmentId || ''}`;
    if (debug !== 'true') {
      const cached = availabilityCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        if (req.query.format === 'legacy') {
          return res.json(cached.data.busySlots.map((ts: string) => ({ timeSlot: ts })));
        }
        return res.json(cached.data);
      }
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
    const parsedDuration = Number(duration || 30);
    if (!Number.isInteger(parsedDuration) || parsedDuration < 5 || parsedDuration > 480) {
      return res.status(400).json({ error: 'Duração inválida. Use um valor inteiro entre 5 e 480 minutos.' });
    }
    const reqDuration = parsedDuration;
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
    const slotIntervalMinutes = daySlotContext.operationSettings?.slotIntervalMinutes || 30;
    for (let m = openMins; m < slotsCutoff; m += slotIntervalMinutes) {
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

    const responseData = {
      date: dateStr,
      busySlots,
      requiresApprovalSlots,
      availableSlots,
      slots: detailedSlots
    };
    
    if (debug !== 'true') {
      const cacheTtlSeconds = daySlotContext.operationSettings?.availabilityCacheTtlSeconds || 20;
      availabilityCache.set(cacheKey, { data: responseData, expiresAt: Date.now() + cacheTtlSeconds * 1000 });
    }

    return res.json(responseData);
  } catch (e: any) {
    console.error('Error in GET /api/availability:', e);
    return res.status(500).json({ error: 'Falha ao processar disponibilidade' });
  }
});
