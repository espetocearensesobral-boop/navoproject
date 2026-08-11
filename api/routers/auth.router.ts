import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { JWT_SECRET } from '../config/env.js';
import { authLimiter, requireAuth, setAuthCookie } from '../middleware/index.js';
import { sanitizePhone, matchPhoneNumbers, handleError, formatProfile } from '../utils/index.js';
import { sendWhatsAppMessage } from '../whatsapp.js';
import { z } from 'zod';

export const authRouter = express.Router();

const themePaletteSchema = z.object({
  palette: z.enum([
    'heritage', 'sapphire', 'emerald', 'amethyst', 'ruby', 'ocean', 'copper', 'rose', 'olive', 'slate',
    'amber', 'teal', 'indigo', 'crimson', 'bronze', 'violet', 'champagne', 'mint', 'coral', 'titanium',
    'cobalt', 'jade', 'sand', 'plum', 'electric', 'sage', 'terracotta', 'midnight', 'lavender', 'bordeaux'
  ]),
});

// /api/auth/me
authRouter.get("/me", requireAuth, async (req: any, res) => {
  try {
    const user = await db.query.profiles.findFirst({
      where: eq(schema.profiles.id, req.user.id)
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(formatProfile(user));
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// /api/auth/logout
authRouter.post("/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true });
});

// /api/auth/login
authRouter.post("/login", authLimiter, async (req, res) => {
  try {
    const { loginId, password } = req.body;
    
    if (!loginId || !password) {
      return res.status(400).json({ error: 'E-mail/telefone e senha são obrigatórios.' });
    }

    const cleanLoginId = sanitizePhone(loginId);
    const cleanEmail = loginId.toString().toLowerCase().trim();

    const allProfiles = await db.query.profiles.findMany();
    const user = allProfiles.find((p: any) => {
      const isGuest = !p.password || p.id === 'usr_guest' || p.id.startsWith('guest_') || (p.email && p.email.endsWith('@guest.barberx.app'));
      if (isGuest) return false;

      const emailMatches = p.email && p.email.toLowerCase().trim() === cleanEmail;
      const phoneMatches = cleanLoginId && p.phone && matchPhoneNumbers(p.phone, cleanLoginId);

      return emailMatches || phoneMatches;
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Dados não encontrados ou credenciais inválidas.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Dados não encontrados ou credenciais inválidas.' });
    }

    const safeUser = formatProfile(user);
    
    // Vincula agendamentos de visitante pendentes com o mesmo telefone do usuário ao logar
    if (user.phone) {
      try {
        const allApts = await db.select().from(schema.appointments);
        const unlinked = allApts.filter((apt: any) => 
          (!apt.clientId || apt.clientId === 'usr_guest' || apt.clientId.startsWith('guest_')) &&
          matchPhoneNumbers(apt.clientPhone, user.phone)
        );
        for (const apt of unlinked) {
          await db.update(schema.appointments)
            .set({ clientId: user.id, updatedAt: new Date() })
            .where(eq(schema.appointments.id, apt.id));
        }
      } catch (e) {}
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, phone: user.phone }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    setAuthCookie(res, token);

    res.json({
      ...safeUser,
      token: token,
    });
  } catch (e: any) {
    console.error('Error in POST /api/auth/login:', e);
    res.status(500).json({ error: 'Erro ao fazer login. Tente novamente.' });
  }
});

authRouter.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { loginId } = req.body;
    if (!loginId) {
      return res.status(400).json({ error: 'E-mail ou telefone é obrigatório.' });
    }
    const cleanLoginId = sanitizePhone(loginId);
    const cleanEmail = loginId.toString().toLowerCase().trim();

    const allProfiles = await db.query.profiles.findMany();
    const user = allProfiles.find((p: any) => {
      const isGuest = !p.password || p.id === 'usr_guest' || p.id.startsWith('guest_') || (p.email && p.email.endsWith('@guest.barberx.app'));
      if (isGuest) return false;

      const emailMatches = p.email && p.email.toLowerCase().trim() === cleanEmail;
      const phoneMatches = cleanLoginId && p.phone && matchPhoneNumbers(p.phone, cleanLoginId);

      return emailMatches || phoneMatches;
    });

    if (user && user.phone) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      await db.update(schema.profiles)
        .set({ resetCodeHash: codeHash, resetCodeExpiresAt: expiresAt })
        .where(eq(schema.profiles.id, user.id));

      const msg = `🔑 *BARBERX PREMIUM*\n\nOlá, *${user.name}*!\n\nRecebemos uma solicitação de redefinição de senha para sua conta.\n\nUse o código de verificação: *${code}*\n\nEle expira em 10 minutos. Se não foi você quem solicitou, desconsidere esta mensagem.`;
      sendWhatsAppMessage(user.phone, msg).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Se o cadastro existir, um código de verificação foi enviado por WhatsApp.'
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

authRouter.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { loginId, code, newPassword } = req.body;
    if (!loginId || !code || !newPassword) {
      return res.status(400).json({ error: 'Código e nova senha são obrigatórios.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    const cleanLoginId = sanitizePhone(loginId);
    const cleanEmail = loginId.toString().toLowerCase().trim();

    const allProfiles = await db.query.profiles.findMany();
    const user = allProfiles.find((p: any) => {
      const isGuest = !p.password || p.id === 'usr_guest' || p.id.startsWith('guest_') || (p.email && p.email.endsWith('@guest.barberx.app'));
      if (isGuest) return false;

      const emailMatches = p.email && p.email.toLowerCase().trim() === cleanEmail;
      const phoneMatches = cleanLoginId && p.phone && matchPhoneNumbers(p.phone, cleanLoginId);

      return emailMatches || phoneMatches;
    });

    const invalidResponse = () => res.status(400).json({ error: 'Código inválido ou expirado.' });

    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      return invalidResponse();
    }
    if (new Date(user.resetCodeExpiresAt).getTime() < Date.now()) {
      return invalidResponse();
    }

    const codeMatches = await bcrypt.compare(String(code), user.resetCodeHash);
    if (!codeMatches) {
      return invalidResponse();
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(schema.profiles)
      .set({ password: hashedPassword, resetCodeHash: null, resetCodeExpiresAt: null })
      .where(eq(schema.profiles.id, user.id));

    res.json({ success: true, message: 'Senha redefinida com sucesso.' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// Create preferences router inside here for simplicity
export const preferencesRouter = express.Router();

preferencesRouter.get("/theme", async (req: any, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: 'Banco de dados indisponível' });
    }

    let userPalette = null;
    const authHeader = req.headers.authorization;
    const token = req.cookies?.token || (authHeader && authHeader.split(' ')[1]);

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded?.id) {
          const user = await db.query.profiles.findFirst({
            where: eq(schema.profiles.id, decoded.id),
            columns: { themePalette: true },
          });
          if (user?.themePalette) {
            userPalette = user.themePalette;
          }
        }
      } catch (err) {}
    }

    if (userPalette) {
      return res.json({ palette: userPalette });
    }

    // Retorna tema configurado da barbearia para visitantes e clientes não logados
    const shop = await db.query.shopSettings.findFirst({
      where: eq(schema.shopSettings.id, 'default'),
      columns: { themePalette: true },
    });

    return res.json({ palette: shop?.themePalette || 'heritage' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

preferencesRouter.put("/theme", requireAuth, async (req: any, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: 'Banco de dados indisponível' });
    }

    const parsed = themePaletteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Paleta de tema inválida.' });
    }

    const nextPalette = parsed.data.palette;

    const [updatedUser] = await db.update(schema.profiles)
      .set({ themePalette: nextPalette, updatedAt: new Date() })
      .where(eq(schema.profiles.id, req.user.id))
      .returning({ themePalette: schema.profiles.themePalette });

    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Se o usuário for admin ou profissional, sincroniza com a paleta padrão da barbearia
    if (req.user.role === 'admin' || req.user.role === 'professional') {
      try {
        await db.insert(schema.shopSettings)
          .values({ id: 'default', themePalette: nextPalette, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: schema.shopSettings.id,
            set: { themePalette: nextPalette, updatedAt: new Date() }
          });
      } catch (shopErr) {
        console.error("Erro ao atualizar tema da barbearia:", shopErr);
      }
    }

    return res.json({ success: true, palette: updatedUser.themePalette });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
