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
    const { name, email, phone, password, role, id, avatar_url, avatarUrl, lgpdConsent, lgpdConsentDate, ...rest } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }
    
    const cleanPhone = sanitizePhone(phone);
    const cleanEmail = email ? email.toLowerCase().trim() : '';

    const dbProfiles = await db.query.profiles.findMany();

    // 1. Verificação de E-mail Único (se o e-mail foi preenchido)
    const existingEmailUser = cleanEmail 
      ? dbProfiles.find((p: any) => p.email && p.email.toLowerCase().trim() === cleanEmail && !p.email.endsWith('@guest.barberx.app'))
      : null;

    if (existingEmailUser) {
      return res.status(400).json({ error: 'E-mail já cadastrado. Por favor faça login.' });
    }

    // 2. Verificação de Telefone já cadastrado em outra CONTA COM SENHA
    const existingPhoneUser = cleanPhone 
      ? dbProfiles.find((p: any) => p.phone && matchPhoneNumbers(p.phone, cleanPhone) && p.password && p.id !== 'usr_guest' && !p.id.startsWith('guest_'))
      : null;

    if (existingPhoneUser) {
      return res.status(400).json({ error: 'Telefone já cadastrado em outra conta. Por favor faça login.' });
    }

    // Se houver perfis temporários de visitante com o mesmo telefone, podemos limpá-los para evitar duplicidade
    if (cleanPhone) {
      try {
        const guestProfilesToDelete = dbProfiles.filter((p: any) => 
          (!p.password || p.id.startsWith('guest_') || p.id === 'usr_guest') &&
          matchPhoneNumbers(p.phone, cleanPhone)
        );
        for (const gp of guestProfilesToDelete) {
          await db.delete(schema.profiles).where(eq(schema.profiles.id, gp.id)).catch(() => {});
        }
      } catch (eClean) {}
    }

    let hashedPassword = password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const newId = crypto.randomUUID();
    const avatar = avatar_url || avatarUrl || rest.avatar_url || rest.avatarUrl || null;
    const finalEmail = cleanEmail || `${cleanPhone || newId.slice(0, 8)}@client.barberx.app`;

    const dbProfile = {
      id: newId,
      name,
      email: finalEmail,
      phone: cleanPhone || '',
      password: hashedPassword,
      role: 'client',
      avatarUrl: avatar,
      loyaltyPoints: 0,
      loyaltyTier: 'Bronze',
      lgpdConsent: Boolean(lgpdConsent),
      lgpdConsentDate: lgpdConsent ? (lgpdConsentDate ? new Date(lgpdConsentDate) : new Date()) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.insert(schema.profiles).values(dbProfile);

    // VINCULAÇÃO AUTOMÁTICA DE REGISTROS DE VISITANTE:
    // Vincula todos os agendamentos de visitante anteriores com o mesmo telefone ao novo perfil
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
            .where(eq(schema.appointments.id, apt.id));
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
    
    const { password, role, id, avatar_url, avatarUrl, loyaltyPoints, loyalty_points, loyaltyTier, loyalty_tier, name, email, phone, ...rest } = req.body;
    
    let setObj: any = { updatedAt: new Date() };

    if (name !== undefined) setObj.name = name;
    if (email !== undefined) setObj.email = email.toLowerCase().trim();
    if (phone !== undefined) setObj.phone = sanitizePhone(phone);

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
    
    await db.delete(schema.profiles).where(eq(schema.profiles.id, req.params.id));

    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
