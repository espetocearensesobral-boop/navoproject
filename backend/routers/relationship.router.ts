import { GoogleGenAI } from '@google/genai';
import { sendWhatsAppMessage } from '../whatsapp.js';
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { db, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { handleError } from '../utils/index.js';
import { getTodayStringBRT } from '../utils/datetime.js';

export const relationshipRouter = express.Router();

relationshipRouter.use(requireAuth, requireAdmin);

const brtDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};

const todayIso = () => getTodayStringBRT();

const diffDays = (from: string, to: string) => {
  const start = new Date(`${from}T12:00:00`).getTime();
  const end = new Date(`${to}T12:00:00`).getTime();
  return Math.max(0, Math.round((end - start) / 86400000));
};

const isRealClient = (profile: any) => {
  const id = String(profile?.id || '');
  const email = String(profile?.email || '');
  return profile?.role === 'client' && !id.startsWith('guest_') && !email.endsWith('@guest.barberx.app');
};

const profileSummary = (profile: any) => ({
  id: profile.id,
  name: profile.name || 'Cliente sem nome',
  email: profile.email || '',
  phone: profile.phone || '',
  birthday: profile.birthday || null,
  loyaltyTier: profile.loyaltyTier || 'Bronze',
  loyaltyPoints: Number(profile.loyaltyPoints || 0),
  createdAt: profile.createdAt,
});

relationshipRouter.get('/follow-up', async (req, res) => {
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: 'Banco de dados indisponível.' });
    const requestedDays = Number(req.query.days || 60);
    const days = Number.isFinite(requestedDays) ? Math.min(365, Math.max(30, Math.round(requestedDays))) : 60;
    const today = todayIso();
    const search = String(req.query.search || '').trim().toLowerCase();

    const [profiles, appointments] = await Promise.all([
      db.query.profiles.findMany(),
      db.query.appointments.findMany(),
    ]);

    const clientProfiles = profiles.filter(isRealClient);
    const byClient = new Map<string, any[]>();
    for (const appointment of appointments) {
      if (!appointment.clientId || appointment.status === 'cancelled' || appointment.status === 'no_show') continue;
      const date = brtDate(appointment.date);
      if (!date || date > today) continue;
      const current = byClient.get(appointment.clientId) || [];
      current.push(appointment);
      byClient.set(appointment.clientId, current);
    }

    const clients = clientProfiles.map((profile) => {
      const history = (byClient.get(profile.id) || []).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.timeSlot || '').localeCompare(String(a.timeSlot || '')));
      const lastAppointment = history[0] || null;
      const lastVisit = lastAppointment ? brtDate(lastAppointment.date) : null;
      const daysSinceLastVisit = lastVisit ? diffDays(lastVisit, today) : null;
      return {
        ...profileSummary(profile),
        lastVisit,
        daysSinceLastVisit,
        appointmentCount: history.length,
        hasEmail: Boolean(profile.email && !String(profile.email).endsWith('@client.barberx.app')),
        hasPhone: Boolean(profile.phone),
      };
    }).filter((client) => {
      const matchesSearch = !search || client.name.toLowerCase().includes(search) || client.email.toLowerCase().includes(search) || client.phone.includes(search);
      const inactive = client.daysSinceLastVisit === null || client.daysSinceLastVisit >= days;
      return matchesSearch && inactive;
    }).sort((a, b) => {
      if (a.daysSinceLastVisit === null) return -1;
      if (b.daysSinceLastVisit === null) return 1;
      return b.daysSinceLastVisit - a.daysSinceLastVisit;
    });

    res.json({
      generatedAt: new Date().toISOString(),
      thresholdDays: days,
      summary: {
        totalClients: clientProfiles.length,
        inactiveClients: clients.length,
        withEmail: clients.filter((client) => client.hasEmail).length,
        withPhone: clients.filter((client) => client.hasPhone).length,
      },
      clients,
    });
  } catch (error) {
    return handleError(res, error, req.path);
  }
});

relationshipRouter.get('/birthdays', async (req, res) => {
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: 'Banco de dados indisponível.' });
    const today = todayIso();
    const currentYear = Number(today.slice(0, 4));
    const requestedMonth = String(req.query.month || 'current').toLowerCase();
    const month: 'all' | 'current' | 'upcoming' | number = requestedMonth === 'all' || requestedMonth === 'current' || requestedMonth === 'upcoming' ? requestedMonth : Number(requestedMonth);
    const search = String(req.query.search || '').trim().toLowerCase();
    const tier = String(req.query.tier || 'all').toLowerCase();
    const upcomingDaysRaw = Number(req.query.upcomingDays || 30);
    const upcomingDays = Number.isFinite(upcomingDaysRaw) ? Math.min(90, Math.max(7, Math.round(upcomingDaysRaw))) : 30;

    const [profiles, appointments] = await Promise.all([
      db.query.profiles.findMany(),
      db.query.appointments.findMany(),
    ]);
    const clientProfiles = profiles.filter((profile) => isRealClient(profile) && /^\d{4}-\d{2}-\d{2}$/.test(String(profile.birthday || '')));
    const latestVisitByClient = new Map<string, string>();
    for (const appointment of appointments) {
      if (!appointment.clientId || appointment.status === 'cancelled' || appointment.status === 'no_show') continue;
      const date = brtDate(appointment.date);
      if (!date || date > today) continue;
      const previous = latestVisitByClient.get(appointment.clientId);
      if (!previous || date > previous) latestVisitByClient.set(appointment.clientId, date);
    }

    const birthdayClients = clientProfiles.map((profile) => {
      const birthday = String(profile.birthday);
      const monthNumber = Number(birthday.slice(5, 7));
      const dayNumber = Number(birthday.slice(8, 10));
      const thisYearBirthday = `${currentYear}-${birthday.slice(5)}`;
      let daysUntil = diffDays(today, thisYearBirthday);
      if (thisYearBirthday < today) {
        daysUntil = diffDays(today, `${currentYear + 1}-${birthday.slice(5)}`);
      }
      const birthdayDateForAge = new Date(`${birthday}T12:00:00`);
      const todayDate = new Date(`${today}T12:00:00`);
      let age = currentYear - birthdayDateForAge.getFullYear();
      if (todayDate < new Date(`${currentYear}-${birthday.slice(5)}T12:00:00`)) age -= 1;
      return {
        ...profileSummary(profile),
        month: monthNumber,
        day: dayNumber,
        daysUntil,
        age: age >= 0 && age < 130 ? age : null,
        lastVisit: latestVisitByClient.get(profile.id) || null,
        hasEmail: Boolean(profile.email && !String(profile.email).endsWith('@client.barberx.app')),
        hasPhone: Boolean(profile.phone),
      };
    }).filter((client) => {
      const matchesMonth = month === 'all'
        || month === 'upcoming'
        || (month === 'current' ? client.month === Number(today.slice(5, 7)) : client.month === month);
      const matchesUpcoming = month === 'upcoming' ? client.daysUntil <= upcomingDays : true;
      const matchesTier = tier === 'all' || client.loyaltyTier.toLowerCase() === tier;
      const matchesSearch = !search || client.name.toLowerCase().includes(search) || client.email.toLowerCase().includes(search) || client.phone.includes(search);
      return matchesMonth && matchesUpcoming && matchesTier && matchesSearch;
    }).sort((a, b) => a.daysUntil - b.daysUntil || a.month - b.month || a.day - b.day || a.name.localeCompare(b.name));

    const allBirthdays = clientProfiles.map((profile) => {
      const birthday = String(profile.birthday);
      const date = `${currentYear}-${birthday.slice(5)}`;
      const daysUntil = date < today ? diffDays(today, `${currentYear + 1}-${birthday.slice(5)}`) : diffDays(today, date);
      return { month: Number(birthday.slice(5, 7)), daysUntil };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalWithBirthday: clientProfiles.length,
        shown: birthdayClients.length,
        currentMonth: allBirthdays.filter((item) => item.month === Number(today.slice(5, 7))).length,
        next7Days: allBirthdays.filter((item) => item.daysUntil <= 7).length,
        next30Days: allBirthdays.filter((item) => item.daysUntil <= 30).length,
        withoutEmail: clientProfiles.filter((profile) => !profile.email || String(profile.email).endsWith('@client.barberx.app')).length,
      },
      monthlyDistribution: Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        count: allBirthdays.filter((item) => item.month === index + 1).length,
      })),
      clients: birthdayClients,
      upcomingDays,
    });
  } catch (error) {
    return handleError(res, error, req.path);
  }
});

relationshipRouter.post('/follow-up/generate', async (req, res) => {
  try {
    const { name, daysSinceLastVisit, appointmentCount, loyaltyTier } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
Você é um assistente de marketing para uma barbearia/salão (Navo). 
Escreva uma mensagem curta (máximo 3 frases) e amigável para enviar pelo WhatsApp para um cliente que não vem há um tempo.
Nome do cliente: ${name.split(' ')[0]}
Dias desde a última visita: ${daysSinceLastVisit}
Total de visitas anteriores: ${appointmentCount}
Nível de fidelidade: ${loyaltyTier}

Não use saudações formais demais. Seja convidativo, ofereça para agendar um horário. 
Não invente promoções a menos que seja um cliente inativo há mais de 90 dias (você pode sugerir que temos um horário especial). 
Traga a mensagem pronta para enviar, sem aspas e sem placeholders. Use emojis adequados.
`;
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
    });
    const message = response.text || 'Olá! Sentimos sua falta. Que tal agendar um horário com a gente?';
    res.json({ message });
  } catch (error) {
    handleError(res, error, req.path);
  }
});

relationshipRouter.post('/follow-up/send', async (req, res) => {
  try {
    const { clientId, phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios.' });
    
    // Save locally to simulate bot conversation creation if we had a local DB table for messages.
    // We just rely on sendWhatsAppMessage which uses Evolution or Meta.
    const sent = await sendWhatsAppMessage(phone, message);
    if (!sent) {
      return res.status(500).json({ error: 'Nenhum provedor de WhatsApp (Evolution/Meta) está configurado ou ativo para enviar esta mensagem.' });
    }
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, req.path);
  }
});
