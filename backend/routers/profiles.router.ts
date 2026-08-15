import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { JWT_SECRET } from '../config/env.js';
import { authLimiter, requireAuth, setAuthCookie } from '../middleware/index.js';
import { sanitizePhone, matchPhoneNumbers, handleError, formatProfile, userErrors } from '../utils/index.js';

export const profilesRouter = express.Router();

profilesRouter.get("/", requireAuth, async (req: any, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: userErrors.dbDisconnected });
    }
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    const dbProfiles = await db.query.profiles.findMany();
    let safe = dbProfiles.map((p: any) => formatProfile(p));
    if (!isAdmin) {
      safe = safe.filter((p: any) => p.id === userId);
    } else {
      safe = safe.filter((p: any) => p.password || (!p.id.startsWith('guest_') && p.id !== 'usr_guest'));
    }
    return res.json(safe);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

profilesRouter.post("/", authLimiter, async (req, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: userErrors.dbDisconnected });
    }
    const { name, email, phone, birthday, password, role, id, avatar_url, avatarUrl, lgpdConsent, lgpdConsentDate, ...rest } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }
    
    const cleanPhone = sanitizePhone(phone);
    const cleanEmail = email ? email.toLowerCase().trim() : '';

    if (cleanEmail) {
      const existingEmailUser = await db.query.profiles.findFirst({
        where: eq(schema.profiles.email, cleanEmail)
      });
      if (existingEmailUser) {
        return res.status(400).json({ error: 'E-mail já cadastrado. Por favor faça login.' });
      }
    }

    if (cleanPhone) {
      const existingPhoneUser = await db.query.profiles.findFirst({
        where: eq(schema.profiles.phone, cleanPhone)
      });
      if (existingPhoneUser && existingPhoneUser.password) {
        return res.status(400).json({ error: 'Telefone já cadastrado em outra conta. Por favor faça login.' });
      }
    }

    let hashedPassword = password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const newId = crypto.randomUUID();
    const avatar = avatar_url || avatarUrl || rest.avatar_url || rest.avatarUrl || null;
    
    // Email padrão se não fornecido, garantindo unicidade no banco de dados
    let finalEmail = cleanEmail;
    if (!finalEmail) {
      const baseEmail = `${cleanPhone || newId.slice(0, 8)}@client.barberx.app`;
      const emailExists = await db.query.profiles.findFirst({ where: eq(schema.profiles.email, baseEmail) });
      finalEmail = emailExists ? `${cleanPhone || newId.slice(0, 8)}_${newId.slice(0, 4)}@client.barberx.app` : baseEmail;
    }

    const normalizedBirthday = birthday ? String(birthday).trim() : null;
    if (normalizedBirthday && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedBirthday)) {
      return res.status(400).json({ error: 'Data de aniversário inválida. Use o formato AAAA-MM-DD.' });
    }

    // Tratamento seguro de data LGPD
    let parsedLgpdDate: Date | null = null;
    if (lgpdConsent) {
      if (lgpdConsentDate && typeof lgpdConsentDate === 'string') {
        const d = new Date(lgpdConsentDate);
        parsedLgpdDate = isNaN(d.getTime()) ? new Date() : d;
      } else {
        parsedLgpdDate = new Date();
      }
    }

    const dbProfile = {
      id: newId,
      name,
      email: finalEmail,
      phone: cleanPhone || '',
      birthday: normalizedBirthday,
      password: hashedPassword,
      role: 'client',
      avatarUrl: avatar,
      loyaltyPoints: 0,
      loyaltyTier: 'Bronze',
      lgpdConsent: Boolean(lgpdConsent),
      lgpdConsentDate: parsedLgpdDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.insert(schema.profiles).values(dbProfile);

    // VINCULAÇÃO AUTOMÁTICA DE REGISTROS DE VISITANTE:
    // Vincula todos os agendamentos e fila de espera de visitante anteriores com o mesmo telefone ao novo perfil
    if (cleanPhone) {
      try {
        const allApts = await db.select().from(schema.appointments);
        const guestAptsToLink = allApts.filter((apt: any) => 
          (!apt.clientId || apt.clientId === 'usr_guest' || apt.clientId.startsWith('guest_')) &&
          matchPhoneNumbers(apt.clientPhone, cleanPhone)
        );
        for (const apt of guestAptsToLink) {
          await db.update(schema.appointments)
            .set({ clientId: newId, updatedAt: new Date() })
            .where(eq(schema.appointments.id, apt.id)).catch(() => {});
        }

        const allQueue = await db.select().from(schema.waitingQueue);
        const guestQueueToLink = allQueue.filter((q: any) =>
          (!q.clientId || q.clientId === 'usr_guest' || q.clientId.startsWith('guest_'))
        );
        for (const q of guestQueueToLink) {
          await db.update(schema.waitingQueue)
            .set({ clientId: newId, updatedAt: new Date() })
            .where(eq(schema.waitingQueue.id, q.id)).catch(() => {});
        }
      } catch (errLink) {
        console.error('Error linking visitor appointments to new profile:', errLink);
      }
    }

    const safeProfile = formatProfile(dbProfile);
    
    const token = jwt.sign(
      { id: safeProfile.id, role: safeProfile.role, email: safeProfile.email, phone: safeProfile.phone }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    setAuthCookie(res, token);

    res.json({
      ...safeProfile,
      token: token,
    });
  } catch (e: any) {
    console.error('Error in POST /api/profiles:', e);
    return handleError(res, e, req.path);
  }
});

profilesRouter.put("/:id", requireAuth, async (req: any, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado: Você só pode editar o próprio perfil' });
    }
    
    const { password, role, id, avatar_url, avatarUrl, loyaltyPoints, loyalty_points, loyaltyTier, loyalty_tier, name, email, phone, birthday, ...rest } = req.body;
    
    let setObj: any = { updatedAt: new Date() };

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName || normalizedName.length > 120) return res.status(400).json({ error: 'Nome inválido.' });
      setObj.name = normalizedName;
    }
    if (email !== undefined) {
      const normalizedEmail = String(email).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ error: 'E-mail inválido.' });
      const existingEmail = await db.query.profiles.findFirst({ where: eq(schema.profiles.email, normalizedEmail) });
      if (existingEmail && existingEmail.id !== req.params.id) return res.status(409).json({ error: 'E-mail já está em uso.' });
      setObj.email = normalizedEmail;
    }
    if (phone !== undefined) {
      const normalizedPhone = sanitizePhone(phone);
      if (normalizedPhone && normalizedPhone.length < 10) return res.status(400).json({ error: 'Telefone inválido.' });
      const existingPhone = normalizedPhone ? await db.query.profiles.findFirst({ where: eq(schema.profiles.phone, normalizedPhone) }) : null;
      if (existingPhone && existingPhone.id !== req.params.id) return res.status(409).json({ error: 'Telefone já está em uso.' });
      setObj.phone = normalizedPhone;
    }
    if (birthday !== undefined) {
      const normalizedBirthday = birthday ? String(birthday).trim() : null;
      if (normalizedBirthday && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedBirthday)) return res.status(400).json({ error: 'Data de aniversário inválida. Use o formato AAAA-MM-DD.' });
      setObj.birthday = normalizedBirthday;
    }

    const avatar = avatar_url !== undefined ? avatar_url : avatarUrl;
    if (avatar !== undefined) {
      setObj.avatarUrl = avatar;
    }

    if (req.user.role === 'admin') {
      const points = loyaltyPoints ?? loyalty_points;
      if (points !== undefined) setObj.loyaltyPoints = points;
      const tier = loyaltyTier ?? loyalty_tier;
      if (tier !== undefined) setObj.loyaltyTier = tier;
    }

    if (password) {
      if (String(password).length < 6 || String(password).length > 200) return res.status(400).json({ error: 'A senha deve ter entre 6 e 200 caracteres.' });
      setObj.password = await bcrypt.hash(password, 10);
    }

    await db.update(schema.profiles).set(setObj).where(eq(schema.profiles.id, req.params.id));

    const updatedProfile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.id, req.params.id)
    });

    res.json(formatProfile(updatedProfile || { id: req.params.id, ...setObj }));
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

profilesRouter.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado: Você só pode deletar o próprio perfil' });
    }
    
    const linkedAppointments = await db.select({ id: schema.appointments.id })
      .from(schema.appointments)
      .where(eq(schema.appointments.clientId, req.params.id))
      .limit(1);
    if (linkedAppointments.length > 0) {
      return res.status(409).json({ error: 'Não é possível excluir um perfil com histórico de agendamentos. Desative o acesso em vez disso.' });
    }
    const linkedQueue = await db.select({ id: schema.waitingQueue.id })
      .from(schema.waitingQueue)
      .where(eq(schema.waitingQueue.clientId, req.params.id))
      .limit(1);
    if (linkedQueue.length > 0) {
      return res.status(409).json({ error: 'Não é possível excluir um perfil vinculado à fila de atendimento.' });
    }

    const deleted = await db.delete(schema.profiles)
      .where(eq(schema.profiles.id, req.params.id))
      .returning({ id: schema.profiles.id });
    if (deleted.length === 0) return res.status(404).json({ error: 'Perfil não encontrado.' });
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
